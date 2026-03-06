import { auth, rtdb } from "./firebase.js";
import { onAuthStateChanged, signOut, deleteUser } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, onValue, push, set, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function showToast(type, msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.remove("hidden", "error", "success");
  toast.classList.add(type === "success" ? "success" : "error");
  toast.textContent = msg;
  setTimeout(() => toast.classList.add("hidden"), 2600);
}

function redirectWithReason(reason) {
  localStorage.setItem("redirectReason", reason);
  window.location.href = "index.html";
}

function pickDoctorName(doctor) {
  const first = doctor.firstName || doctor.Prénom || "";
  const last = doctor.lastName || doctor.name || "";
  const full = `${first} ${last}`.trim();
  return full || "—";
}

function isPhone8Digits(v) {
  return /^[0-9]{8}$/.test(v);
}

async function fileToBase64(file) {
  if (!file) return null;
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Lecture photo impossible"));
    reader.readAsDataURL(file);
  });
}

function confirmDialog({ title, msg, desc, okText = "Confirmer" }) {
  const dlg = document.getElementById("confirmDialog");
  const t = document.getElementById("confirmTitle");
  const m = document.getElementById("confirmMsg");
  const d = document.getElementById("confirmDesc");
  const x = document.getElementById("confirmX");
  const cancel = document.getElementById("confirmCancel");
  const ok = document.getElementById("confirmOk");
  const backdrop = document.getElementById("confirmBackdrop");

  if (!dlg || !t || !m || !d || !x || !cancel || !ok) {
    return Promise.resolve(window.confirm(msg || "Confirmer ?"));
  }

  t.textContent = title || "Confirmation";
  m.textContent = msg || "";
  d.textContent = desc || "";
  ok.textContent = okText;

  dlg.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = (value) => {
      dlg.classList.add("hidden");
      backdrop?.removeEventListener("click", onCancel);
      x.removeEventListener("click", onCancel);
      cancel.removeEventListener("click", onCancel);
      ok.removeEventListener("click", onOk);
      resolve(value);
    };

    const onCancel = () => cleanup(false);
    const onOk = () => cleanup(true);

    backdrop?.addEventListener("click", onCancel);
    x.addEventListener("click", onCancel);
    cancel.addEventListener("click", onCancel);
    ok.addEventListener("click", onOk);
  });
}

function renderPatients(grid, patientsObj, user) {
  if (!patientsObj) {
    grid.innerHTML = `
      <div class="card">
        <div class="avatar"><span>👤</span></div>
        <div>
          <h3>Aucun patient</h3>
          <p class="small">Ajouter un patient pour commencer.</p>
        </div>
      </div>
    `;
    return;
  }

  const items = Object.entries(patientsObj).map(([id, data]) => ({ id, ...data }));
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  grid.innerHTML = items.map((p) => {
    const fullName = p.fullName || "—";
    const phone = p.phone || "—";
    const dossier = p.dossierNumber || "—";
    const disease = p.disease || "—";
    const url = `patient_details.html?id=${encodeURIComponent(p.id)}`;
    const photo = p.photoBase64
      ? `<img src="${p.photoBase64}" alt="Patient" />`
      : `<span>👤</span>`;

    return `
      <div class="card patient-card">
        <div class="avatar">${photo}</div>
        <div style="flex:1">
          <h3>${fullName}</h3>
          <div class="meta">
            <span class="badge wait">${disease}</span>
            <span class="badge ok">${dossier}</span>
          </div>
          <p class="small">${phone}</p>
          <div class="card-actions" style="justify-content:flex-end;">
            <a class="btn-sm primary" href="${url}">Voir détails</a>
            <button class="btn-sm danger btnDeletePatient" type="button" data-id="${p.id}">
              Supprimer patient
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  grid.querySelectorAll(".btnDeletePatient").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const patientId = btn.dataset.id;
      if (!patientId) return;

      const ok = await confirmDialog({
        title: "Supprimer patient",
        msg: "Voulez-vous vraiment supprimer ce patient ?",
        desc: "Cette action supprimera aussi ses médicaments et son dossier médical.",
        okText: "Supprimer"
      });

      if (!ok) return;

      try {
        await remove(ref(rtdb, `patients/${user.uid}/${patientId}`));
        showToast("success", "Patient supprimé ✅");
      } catch (err) {
        showToast("error", "Erreur suppression patient: " + err.message);
      }
    });
  });
}

function openModal() {
  const modal = document.getElementById("patientModal");
  if (modal) modal.classList.remove("hidden");
}

function closeModal() {
  const modal = document.getElementById("patientModal");
  if (modal) modal.classList.add("hidden");
}

const btnAdd = document.getElementById("btnAdd");
const closePatientModal = document.getElementById("closePatientModal");
const xPatientModal = document.getElementById("xPatientModal");

if (btnAdd) btnAdd.addEventListener("click", openModal);
if (closePatientModal) closePatientModal.addEventListener("click", closeModal);
if (xPatientModal) xPatientModal.addEventListener("click", closeModal);

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user) return redirectWithReason("not_logged_in");
    if (user.emailVerified !== true) return redirectWithReason("email_not_verified");

    const doctorSnap = await get(ref(rtdb, `doctors/${user.uid}`));
    if (!doctorSnap.exists()) return redirectWithReason("not_doctor");

    const doctor = doctorSnap.val();

    document.getElementById("doctorName").textContent = pickDoctorName(doctor);
    document.getElementById("doctorSpeciality").textContent = doctor.speciality || "—";

    const btnLogout = document.getElementById("btnLogout");
    if (btnLogout) {
      btnLogout.addEventListener("click", async (e) => {
        e.preventDefault();
        await signOut(auth);
        window.location.href = "index.html";
      });
    }

    const btnDeleteAccount = document.getElementById("btnDeleteAccount");
    if (btnDeleteAccount) {
      btnDeleteAccount.addEventListener("click", async (e) => {
        e.preventDefault();

        const ok = await confirmDialog({
          title: "Supprimer le compte",
          msg: "Voulez-vous vraiment supprimer votre compte ?",
          desc: "Cette action supprimera vos données et elle est irréversible.",
          okText: "Supprimer"
        });

        if (!ok) return;

        try {
          const uid = user.uid;
          await remove(ref(rtdb, `patients/${uid}`));
          await remove(ref(rtdb, `plans/${uid}`));
          await remove(ref(rtdb, `logs/${uid}`));
          await remove(ref(rtdb, `doctors/${uid}`));
          await deleteUser(user);
          showToast("success", "Compte supprimé ✅");
          window.location.href = "index.html";
        } catch (err) {
          if (err?.code === "auth/requires-recent-login") {
            showToast("error", "Reconnexion requise. Déconnectez-vous puis reconnectez-vous.");
            await signOut(auth);
            window.location.href = "index.html";
            return;
          }
          showToast("error", err?.message || "Erreur suppression compte");
        }
      });
    }

    const grid = document.getElementById("patientsGrid");
    if (grid) {
      onValue(ref(rtdb, `patients/${user.uid}`), (snap) => {
        console.log("Patients data:", snap.val());
        renderPatients(grid, snap.val(), user);
      });
    }

    const patientForm = document.getElementById("patientForm");
    if (patientForm) {
      patientForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = document.getElementById("pFullName").value.trim();
        const phone = document.getElementById("pPhone").value.trim();
        const supervisorName = document.getElementById("pSupervisorName").value.trim();
        const supervisorPhone = document.getElementById("pSupervisorPhone").value.trim();
        const birthDate = document.getElementById("pBirthDate").value;
        const dossierNumber = document.getElementById("pDossier").value.trim();
        const disease = document.getElementById("pDisease").value.trim();
        const notes = document.getElementById("pNotes").value.trim();
        const file = document.getElementById("pPhoto").files?.[0] || null;

        if (!fullName || !phone || !supervisorPhone || !birthDate || !dossierNumber || !disease) {
          showToast("error", "Champs obligatoires manquants.");
          return;
        }

        if (!isPhone8Digits(phone) || !isPhone8Digits(supervisorPhone)) {
          showToast("error", "Téléphone doit contenir 8 chiffres.");
          return;
        }

        if (phone === supervisorPhone) {
          showToast("error", "Téléphone patient doit être différent du superviseur.");
          return;
        }

        try {
          const photoBase64 = await fileToBase64(file);
          const newRef = push(ref(rtdb, `patients/${user.uid}`));

          await set(newRef, {
            fullName,
            phone,
            supervisorName,
            supervisorPhone,
            birthDate,
            dossierNumber,
            disease,
            notes: notes || "",
            photoBase64: photoBase64 || "",
            createdAt: Date.now()
          });

          patientForm.reset();
          closeModal();
          showToast("success", "Patient ajouté ✅");
        } catch (err) {
          showToast("error", "Erreur ajout: " + err.message);
        }
      });
    }
  } catch (err) {
    console.error(err);
    showToast("error", "Erreur JS: " + (err?.message || "inconnue"));
  }
});