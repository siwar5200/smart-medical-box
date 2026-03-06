import { auth, rtdb } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  ref,
  get,
  set,
  update
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function showToast(type, msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.classList.remove("hidden", "error", "success");
  toast.classList.add(type === "success" ? "success" : "error");
  toast.textContent = msg;

  setTimeout(() => toast.classList.add("hidden"), 2600);
}

const savedEmail = localStorage.getItem("lastEmail");
const emailInput = document.getElementById("email");
if (savedEmail && emailInput) emailInput.value = savedEmail;

const reason = localStorage.getItem("redirectReason");
if (reason) {
  localStorage.removeItem("redirectReason");
  if (reason === "email_not_verified") showToast("error", "Vérifie ton email avant d'accéder au dashboard.");
  if (reason === "not_doctor") showToast("error", "Accès refusé: compte non autorisé (médecin).");
  if (reason === "not_logged_in") showToast("error", "Connecte-toi pour accéder au dashboard.");
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const forgotLink = document.getElementById("forgotLink");
  const resendVerify = document.getElementById("resendVerify");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;

    try {
      const userCred = await signInWithEmailAndPassword(auth, email, password);
      localStorage.setItem("lastEmail", email);

      if (userCred.user.emailVerified !== true) {
        await signOut(auth);
        showToast("error", "Vérifie ton email avant de te connecter.");
        return;
      }

      window.location.href = "dashboard.html";
    } catch (err) {
      showToast("error", "Erreur connexion: " + err.message);
    }
  });

  if (forgotLink) {
    forgotLink.addEventListener("click", async (e) => {
      e.preventDefault();
      const email = loginForm.email.value.trim();
      if (!email) {
        showToast("error", "Saisis ton email d'abord.");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email);
        showToast("success", "Email de réinitialisation envoyé ✅");
      } catch (err) {
        showToast("error", "Erreur reset: " + err.message);
      }
    });
  }

  if (resendVerify) {
    resendVerify.addEventListener("click", async (e) => {
      e.preventDefault();

      const email = loginForm.email.value.trim();
      const password = loginForm.password.value;

      if (!email || !password) {
        showToast("error", "Écris email + mot de passe ثم اضغط renvoyer.");
        return;
      }

      try {
        const userCred = await signInWithEmailAndPassword(auth, email, password);

        if (userCred.user.emailVerified === true) {
          await signOut(auth);
          showToast("success", "Email déjà vérifié ✅. Tu peux te connecter.");
          return;
        }

        await sendEmailVerification(userCred.user);
        await signOut(auth);
        showToast("success", "Email de vérification renvoyé ✅. Vérifie ta boîte mail (Spam aussi).");
      } catch (err) {
        showToast("error", "Erreur: " + err.message);
      }
    });
  }
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = signupForm.querySelector('[name="email"]').value.trim();
    const firstName = signupForm.querySelector('[name="Prénom"]').value.trim();
    const lastName = signupForm.querySelector('[name="name"]').value.trim();
    const speciality = signupForm.querySelector('[name="speciality"]').value.trim();
    const inviteCode = signupForm.querySelector('[name="inviteCode"]').value.trim();
    const phone = signupForm.querySelector('[name="phone"]').value.trim();
    const password = signupForm.querySelector('[name="password"]').value;
    const confirmPassword = signupForm.querySelector('[name="confirmPassword"]').value;

    if (password !== confirmPassword) {
      showToast("error", "Les mots de passe ne correspondent pas !");
      return;
    }

    try {
      const inviteSnap = await get(ref(rtdb, `invites/${inviteCode}`));
      if (!inviteSnap.exists()) {
        showToast("error", "Code invitation incorrect.");
        return;
      }

      const invite = inviteSnap.val();

      if (invite.active !== true) {
        showToast("error", "Code invitation inactif.");
        return;
      }

      if (invite.used === true || invite.used === "true") {
        showToast("error", "Code invitation déjà utilisé.");
        return;
      }

      if (!invite.email || invite.email.toLowerCase() !== email.toLowerCase()) {
        showToast("error", "Email non conforme au code invitation.");
        return;
      }

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const uid = userCred.user.uid;

      await set(ref(rtdb, `doctors/${uid}`), {
        email,
        firstName,
        lastName,
        speciality,
        inviteCode,
        phone,
        createdAt: Date.now()
      });

      await update(ref(rtdb, `invites/${inviteCode}`), {
        used: true,
        usedByUid: uid,
        usedAt: Date.now()
      });

      await sendEmailVerification(userCred.user);

      localStorage.setItem("lastEmail", email);
      showToast("success", "Compte créé ✅. Vérifie ton email puis connecte-toi.");
      setTimeout(() => window.location.href = "index.html", 1200);
    } catch (err) {
      showToast("error", "Erreur inscription: " + err.message);
    }
  });
}