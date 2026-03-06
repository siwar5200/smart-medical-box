import { auth, rtdb } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { ref, get, onValue, push, set, update, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function showToast(type, msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.classList.remove("hidden", "error", "success");
  toast.classList.add(type === "success" ? "success" : "error");
  toast.textContent = msg;
  setTimeout(() => toast.classList.add("hidden"), 2600);
}

function openModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove("hidden");
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add("hidden");
}

function isPhone8Digits(v) {
  return /^[0-9]{8}$/.test(v);
}

function setActiveTab(tabId) {
  const btns = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  const btnAddMed = document.getElementById("btnAddMed");

  btns.forEach((b) => b.classList.toggle("active", b.dataset.tab === tabId));
  panels.forEach((p) => p.classList.toggle("hidden", p.id !== tabId));

  if (btnAddMed) {
    btnAddMed.classList.toggle("hidden", tabId !== "tabMeds");
  }
}

function confirmAction({ title, message, okText = "Confirmer" }) {
  const dlg = document.getElementById("confirmDialog");
  const t = document.getElementById("confirmTitle");
  const m = document.getElementById("confirmMsg");
  const d = document.getElementById("confirmDesc");
  const x = document.getElementById("confirmX");
  const cancel = document.getElementById("confirmCancel");
  const ok = document.getElementById("confirmOk");
  const backdrop = document.getElementById("confirmBackdrop");

  if (!dlg || !t || !m || !ok || !cancel) {
    return Promise.resolve(window.confirm(message || "Confirmer ?"));
  }

  t.textContent = title || "Confirmation";
  m.textContent = message || "";
  if (d) d.textContent = "";
  ok.textContent = okText;

  dlg.classList.remove("hidden");

  return new Promise((resolve) => {
    const cleanup = (value) => {
      dlg.classList.add("hidden");
      backdrop?.removeEventListener("click", onCancel);
      x?.removeEventListener("click", onCancel);
      cancel.removeEventListener("click", onCancel);
      ok.removeEventListener("click", onOk);
      resolve(value);
    };

    const onCancel = () => cleanup(false);
    const onOk = () => cleanup(true);

    backdrop?.addEventListener("click", onCancel);
    x?.addEventListener("click", onCancel);
    cancel.addEventListener("click", onCancel);
    ok.addEventListener("click", onOk);
  });
}

function renderPhoto(photoBase64) {
  const img = document.getElementById("pPhoto");
  const fb = document.getElementById("pPhotoFallback");
  if (!img || !fb) return;

  if (photoBase64) {
    img.src = photoBase64;
    img.classList.remove("hidden");
    fb.classList.add("hidden");
  } else {
    img.removeAttribute("src");
    img.classList.add("hidden");
    fb.classList.remove("hidden");
  }
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

function setRecordEditable(isEditable) {
  const ids = ["mrTitle", "mrDiagnosis", "mrAllergies", "mrHistory", "mrNotes"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.disabled = !isEditable;
  });

  const saveBtn = document.getElementById("btnSaveRecord");
  if (saveBtn) saveBtn.disabled = !isEditable;

  const status = document.getElementById("recordStatus");
  if (status) status.textContent = isEditable ? "Mode modification activé ✍️" : "";
}

const params = new URLSearchParams(window.location.search);
const patientId = params.get("id");
if (!patientId) window.location.href = "dashboard.html";

let editingMedId = null;

function patientPath(uid) {
  return `patients/${uid}/${patientId}`;
}

function medsPath(uid) {
  return `patients/${uid}/${patientId}/medications`;
}

function recordPath(uid) {
  return `patients/${uid}/${patientId}/medicalRecord`;
}

function renderPatientInfo(p) {
  const fullName = p.fullName || "—";
  const dossierNumber = p.dossierNumber || "—";
  const phone = p.phone || "—";
  const supervisorName = p.supervisorName || "—";
  const supervisorPhone = p.supervisorPhone || "—";
  const birthDate = p.birthDate || "—";
  const disease = p.disease || "—";
  const notes = p.notes || "—";

  document.getElementById("pNameSide").textContent = fullName;
  document.getElementById("pDossierSide").textContent = dossierNumber;
  document.getElementById("pPhoneSide").textContent = phone;
  document.getElementById("pSupervisorNameSide").textContent = supervisorName;
  document.getElementById("pSupervisorPhoneSide").textContent = supervisorPhone;
  document.getElementById("pBirthDateSide").textContent = birthDate;
  document.getElementById("pDiseaseSide").textContent = disease;
  document.getElementById("pNotesSide").textContent = notes;

  renderPhoto(p.photoBase64 || "");
}

function renderMeds(medsGrid, meds, onEdit, onDelete) {
  medsGrid.innerHTML = "";

  if (!meds) {
    medsGrid.innerHTML = `
      <div class="card">
        <div class="avatar"><span>💊</span></div>
        <div>
          <h3>Aucun médicament</h3>
          <p class="small">Ajoute un médicament pour commencer.</p>
        </div>
      </div>
    `;
    return;
  }

  const items = Object.entries(meds).map(([id, data]) => ({ id, ...data }));
  items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  for (const m of items) {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <div class="avatar"><span>💊</span></div>
      <div style="flex:1">
        <h3>${m.name || "—"}</h3>
        <div class="meta">
          <span class="badge ok">${m.dose || "—"}</span>
          <span class="badge wait">${m.timesPerDay ? m.timesPerDay + " / jour" : "—"}</span>
        </div>
        <p class="small">Du ${m.startDate || "—"} au ${m.endDate || "—"}</p>
        <div class="card-actions">
          <button class="btn-sm primary" data-action="edit" data-id="${m.id}" type="button">Modifier</button>
          <button class="btn-sm danger" data-action="delete" data-id="${m.id}" type="button">Supprimer</button>
        </div>
      </div>
    `;

    card.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "edit") onEdit(id, m);
      if (action === "delete") onDelete(id);
    });

    medsGrid.appendChild(card);
  }
}

onAuthStateChanged(auth, async (user) => {
  try {
    if (!user || user.emailVerified !== true) {
      window.location.href = "index.html";
      return;
    }

    const doctorSnap = await get(ref(rtdb, `doctors/${user.uid}`));
    if (!doctorSnap.exists()) {
      window.location.href = "index.html";
      return;
    }

    const pSnap = await get(ref(rtdb, patientPath(user.uid)));
    if (!pSnap.exists()) {
      window.location.href = "dashboard.html";
      return;
    }

    const tabs = document.querySelectorAll(".tab-btn");
    tabs.forEach((b) => b.addEventListener("click", () => setActiveTab(b.dataset.tab)));
    setActiveTab("tabRecord");

    setRecordEditable(false);

    const btnEditRecord = document.getElementById("btnEditRecord");
    if (btnEditRecord) {
      btnEditRecord.addEventListener("click", async () => {
        const ok = await confirmAction({
          title: "Modifier dossier médical",
          message: "Activer le mode modification ?",
          okText: "Activer"
        });
        if (!ok) return;
        setRecordEditable(true);
      });
    }

    const btnAddMed = document.getElementById("btnAddMed");
    if (btnAddMed) btnAddMed.addEventListener("click", () => openModal("medModal"));

    const closeMedModalBtn = document.getElementById("closeMedModal");
    const xMedModal = document.getElementById("xMedModal");
    if (closeMedModalBtn) closeMedModalBtn.addEventListener("click", () => closeModal("medModal"));
    if (xMedModal) xMedModal.addEventListener("click", () => closeModal("medModal"));

    const closeEdit = document.getElementById("closeEditMedModal");
    const xEdit = document.getElementById("xEditMedModal");
    if (closeEdit) closeEdit.addEventListener("click", () => closeModal("editMedModal"));
    if (xEdit) xEdit.addEventListener("click", () => closeModal("editMedModal"));

    const closeEditPatient = document.getElementById("closeEditPatientModal");
    const xEditPatient = document.getElementById("xEditPatientModal");
    if (closeEditPatient) closeEditPatient.addEventListener("click", () => closeModal("editPatientModal"));
    if (xEditPatient) xEditPatient.addEventListener("click", () => closeModal("editPatientModal"));

    const btnEditPatient = document.getElementById("btnEditPatient");
    if (btnEditPatient) btnEditPatient.addEventListener("click", () => openModal("editPatientModal"));

    onValue(ref(rtdb, patientPath(user.uid)), (snap) => {
      const p = snap.val();
      if (!p) return;

      renderPatientInfo(p);

      document.getElementById("epFullName").value = p.fullName || "";
      document.getElementById("epPhone").value = p.phone || "";
      document.getElementById("epSupervisorName").value = p.supervisorName || "";
      document.getElementById("epSupervisorPhone").value = p.supervisorPhone || "";
      document.getElementById("epBirthDate").value = p.birthDate || "";
      document.getElementById("epDossier").value = p.dossierNumber || "";
      document.getElementById("epDisease").value = p.disease || "";
      document.getElementById("epNotes").value = p.notes || "";
    });

    onValue(ref(rtdb, recordPath(user.uid)), (snap) => {
      const r = snap.val() || {};
      document.getElementById("mrTitle").value = r.title || "";
      document.getElementById("mrDiagnosis").value = r.diagnosis || "";
      document.getElementById("mrAllergies").value = r.allergies || "";
      document.getElementById("mrHistory").value = r.history || "";
      document.getElementById("mrNotes").value = r.notes || "";
    });

    const medsGrid = document.getElementById("medsGrid");
    if (medsGrid) {
      onValue(ref(rtdb, medsPath(user.uid)), (snap) => {
        renderMeds(
          medsGrid,
          snap.val(),
          (medId, medData) => {
            editingMedId = medId;
            document.getElementById("eName").value = medData.name || "";
            document.getElementById("eDose").value = medData.dose || "";
            document.getElementById("eTimes").value = medData.timesPerDay || 1;
            document.getElementById("eStart").value = medData.startDate || "";
            document.getElementById("eEnd").value = medData.endDate || "";
            openModal("editMedModal");
          },
          async (medId) => {
            const ok = await confirmAction({
              title: "Supprimer médicament",
              message: "Voulez-vous vraiment supprimer ce médicament ?",
              okText: "Supprimer"
            });
            if (!ok) return;

            try {
              await remove(ref(rtdb, `${medsPath(user.uid)}/${medId}`));
              showToast("success", "Médicament supprimé ✅");
            } catch (err) {
              showToast("error", "Erreur suppression: " + err.message);
            }
          }
        );
      });
    }

    const medForm = document.getElementById("medForm");
    if (medForm) {
      medForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const name = document.getElementById("mName").value.trim();
        const dose = document.getElementById("mDose").value.trim();
        const timesPerDay = Number(document.getElementById("mTimes").value);
        const startDate = document.getElementById("mStart").value;
        const endDate = document.getElementById("mEnd").value;

        if (!name || !dose || Number.isNaN(timesPerDay) || !startDate || !endDate) {
          showToast("error", "Champs invalides.");
          return;
        }

        try {
          const newMedRef = push(ref(rtdb, medsPath(user.uid)));
          await set(newMedRef, {
            name,
            dose,
            timesPerDay,
            startDate,
            endDate,
            createdAt: Date.now()
          });

          medForm.reset();
          closeModal("medModal");
          showToast("success", "Médicament ajouté ✅");
        } catch (err) {
          showToast("error", "Erreur: " + err.message);
        }
      });
    }

    const editMedForm = document.getElementById("editMedForm");
    if (editMedForm) {
      editMedForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!editingMedId) {
          showToast("error", "Aucun médicament sélectionné.");
          return;
        }

        const name = document.getElementById("eName").value.trim();
        const dose = document.getElementById("eDose").value.trim();
        const timesPerDay = Number(document.getElementById("eTimes").value);
        const startDate = document.getElementById("eStart").value;
        const endDate = document.getElementById("eEnd").value;

        if (!name || !dose || Number.isNaN(timesPerDay) || !startDate || !endDate) {
          showToast("error", "Champs invalides.");
          return;
        }

        try {
          await update(ref(rtdb, `${medsPath(user.uid)}/${editingMedId}`), {
            name,
            dose,
            timesPerDay,
            startDate,
            endDate,
            updatedAt: Date.now()
          });

          editingMedId = null;
          closeModal("editMedModal");
          showToast("success", "Médicament modifié ✅");
        } catch (err) {
          showToast("error", "Erreur modification: " + err.message);
        }
      });
    }

    const btnSaveRecord = document.getElementById("btnSaveRecord");
    if (btnSaveRecord) {
      btnSaveRecord.addEventListener("click", async () => {
        const payload = {
          title: document.getElementById("mrTitle").value.trim(),
          diagnosis: document.getElementById("mrDiagnosis").value.trim(),
          allergies: document.getElementById("mrAllergies").value.trim(),
          history: document.getElementById("mrHistory").value.trim(),
          notes: document.getElementById("mrNotes").value.trim(),
          updatedAt: Date.now()
        };

        try {
          await set(ref(rtdb, recordPath(user.uid)), payload);
          setRecordEditable(false);
          document.getElementById("recordStatus").textContent = "Dossier enregistré ✅";
          showToast("success", "Dossier médical enregistré ✅");
        } catch (err) {
          document.getElementById("recordStatus").textContent = "";
          showToast("error", "Erreur dossier: " + err.message);
        }
      });
    }

    const editPatientForm = document.getElementById("editPatientForm");
    if (editPatientForm) {
      editPatientForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const fullName = document.getElementById("epFullName").value.trim();
        const phone = document.getElementById("epPhone").value.trim();
        const supervisorName = document.getElementById("epSupervisorName").value.trim();
        const supervisorPhone = document.getElementById("epSupervisorPhone").value.trim();
        const birthDate = document.getElementById("epBirthDate").value;
        const dossierNumber = document.getElementById("epDossier").value.trim();
        const disease = document.getElementById("epDisease").value.trim();
        const notes = document.getElementById("epNotes").value.trim();
        const file = document.getElementById("epPhoto").files?.[0] || null;

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

          const payload = {
            fullName,
            phone,
            supervisorName,
            supervisorPhone,
            birthDate,
            dossierNumber,
            disease,
            notes,
            updatedAt: Date.now()
          };

          if (photoBase64) payload.photoBase64 = photoBase64;

          await update(ref(rtdb, patientPath(user.uid)), payload);

          closeModal("editPatientModal");
          showToast("success", "Patient modifié ✅");
        } catch (err) {
          showToast("error", "Erreur modification patient: " + err.message);
        }
      });
    }
  } catch (err) {
    showToast("error", "Erreur JS: " + (err?.message || "inconnue"));
  }
});