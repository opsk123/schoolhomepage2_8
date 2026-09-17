(function () {
  "use strict";

  window.showToast = function (message, type) {
    var toast = document.createElement("div");
    toast.className = "toast" + (type ? " toast-" + type : "");
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add("is-visible"); });
    setTimeout(function () {
      toast.classList.remove("is-visible");
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 350);
    }, 3400);
  };

  window.esc = function (value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
    });
  };

  var config = window.SUPABASE_CONFIG || {};
  var PLACEHOLDER_URL = "https://YOUR_PROJECT_REF.supabase.co";
  var PLACEHOLDER_KEY = "YOUR_SUPABASE_ANON_KEY";
  var notice = document.getElementById("clubAuthNotice");

  if (!window.supabase || !config.url || !config.anonKey ||
      config.url === PLACEHOLDER_URL || config.anonKey === PLACEHOLDER_KEY) {
    console.warn("[Auth] Supabase 설정이 필요합니다. js/supabase-config.js 파일에 프로젝트 URL과 anon key를 입력하세요.");
    if (notice) {
      notice.hidden = false;
      notice.querySelector("p").innerHTML =
        "Supabase 연동 설정이 필요합니다. <code>js/supabase-config.js</code> 파일에 프로젝트 URL과 anon key를 입력하고, <code>supabase/schema.sql</code>을 SQL Editor에서 실행해주세요.";
      var noticeBtn = notice.querySelector("button");
      if (noticeBtn) noticeBtn.hidden = true;
    }
    return;
  }

  var sb = window.supabase.createClient(config.url, config.anonKey);
  window.sb = sb;

  var modal = document.getElementById("authModal");
  var modalClose = document.getElementById("authModalClose");
  var openLogin = document.getElementById("openLogin");
  var openSignup = document.getElementById("openSignup");
  var logoutBtn = document.getElementById("logoutBtn");
  var welcomeUser = document.getElementById("welcomeUser");
  var guestItems = [document.getElementById("authGuestItem"), document.getElementById("authSignupItem")];
  var userItems = [document.getElementById("authUserItem"), document.getElementById("authLogoutItem")];
  var modalTabs = modal.querySelectorAll(".modal-tab");
  var panels = {
    login: document.getElementById("loginPanel"),
    signup: document.getElementById("signupPanel")
  };
  var loginForm = document.getElementById("loginForm");
  var signupForm = document.getElementById("signupForm");
  var loginError = document.getElementById("loginError");
  var signupError = document.getElementById("signupError");
  var signupOk = document.getElementById("signupOk");

  var ERROR_MAP = [
    ["Invalid login credentials", "이메일 또는 비밀번호가 올바르지 않습니다."],
    ["Email not confirmed", "가입 시 입력한 이메일로 전송된 인증 메일을 확인해주세요."],
    ["User already registered", "이미 가입된 이메일입니다. 로그인해주세요."],
    ["Password should be at least 6 characters", "비밀번호는 6자 이상이어야 합니다."],
    ["Email rate limit exceeded", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요."],
    ["Signups not allowed", "현재 회원가입이 제한되어 있습니다."],
    ["invalid format", "올바른 이메일 형식이 아닙니다."]
  ];

  function translateError(message) {
    for (var i = 0; i < ERROR_MAP.length; i++) {
      if (message && message.indexOf(ERROR_MAP[i][0]) !== -1) return ERROR_MAP[i][1];
    }
    return message || "알 수 없는 오류가 발생했습니다.";
  }

  function setAlert(el, message) {
    el.textContent = message;
    el.hidden = !message;
  }

  function setBusy(btn, busy, label) {
    btn.disabled = busy;
    btn.textContent = busy ? "처리 중..." : label;
  }

  var currentUser = null;
  var currentProfile = null;

  function notifyAuthChange() {
    document.dispatchEvent(new CustomEvent("auth:change", {
      detail: { user: currentUser, profile: currentProfile }
    }));
  }

  function renderHeader() {
    var loggedIn = !!currentUser;
    guestItems.forEach(function (el) { el.hidden = loggedIn; });
    userItems.forEach(function (el) { el.hidden = !loggedIn; });
    if (!loggedIn) welcomeUser.textContent = "";
  }

  async function loadProfile() {
    var res = await sb.from("profiles").select("name, role").eq("id", currentUser.id).maybeSingle();
    currentProfile = res.data || null;
    welcomeUser.textContent = (currentProfile && currentProfile.name ? currentProfile.name : "회원") + "님";
    notifyAuthChange();
  }

  sb.auth.onAuthStateChange(function (event, session) {
    currentUser = session ? session.user : null;
    currentProfile = null;
    renderHeader();
    if (currentUser) loadProfile();
    else notifyAuthChange();
  });

  function switchTab(name) {
    modalTabs.forEach(function (tab) {
      var active = tab.dataset.authTab === name;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", active);
    });
    Object.keys(panels).forEach(function (key) {
      panels[key].classList.toggle("is-active", key === name);
    });
  }

  function openModal(name) {
    switchTab(name || "login");
    modal.classList.add("is-open");
    document.body.classList.add("no-scroll");
    var first = panels[name || "login"].querySelector("input");
    if (first) setTimeout(function () { first.focus(); }, 60);
  }

  function closeModal() {
    modal.classList.remove("is-open");
    document.body.classList.remove("no-scroll");
  }

  openLogin.addEventListener("click", function (e) { e.preventDefault(); openModal("login"); });
  openSignup.addEventListener("click", function (e) { e.preventDefault(); openModal("signup"); });
  modalClose.addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeModal(); });

  modalTabs.forEach(function (tab) {
    tab.addEventListener("click", function () { switchTab(tab.dataset.authTab); });
  });

  document.addEventListener("auth:open", function (e) {
    openModal((e.detail && e.detail.tab) || "login");
  });

  document.addEventListener("click", function (e) {
    if (!e.target || !e.target.closest) return;
    var trigger = e.target.closest("[data-auth-open]");
    if (trigger) {
      e.preventDefault();
      openModal(trigger.getAttribute("data-auth-open"));
    }
  });

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var email = document.getElementById("loginEmail").value.trim();
    var password = document.getElementById("loginPassword").value;
    var btn = loginForm.querySelector("button[type=submit]");
    setAlert(loginError, "");
    if (!email || !password) { setAlert(loginError, "이메일과 비밀번호를 모두 입력해주세요."); return; }
    setBusy(btn, true, "로그인");
    var res = await sb.auth.signInWithPassword({ email: email, password: password });
    setBusy(btn, false, "로그인");
    if (res.error) { setAlert(loginError, translateError(res.error.message)); return; }
    loginForm.reset();
    closeModal();
    showToast("로그인되었습니다. 환영합니다!", "success");
  });

  signupForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var name = document.getElementById("signupName").value.trim();
    var email = document.getElementById("signupEmail").value.trim();
    var password = document.getElementById("signupPassword").value;
    var password2 = document.getElementById("signupPassword2").value;
    var grade = document.getElementById("signupGrade").value;
    var classNo = document.getElementById("signupClass").value;
    var studentNo = document.getElementById("signupStudentNo").value;
    var btn = signupForm.querySelector("button[type=submit]");
    setAlert(signupError, "");
    setAlert(signupOk, "");
    if (!name) { setAlert(signupError, "이름을 입력해주세요."); return; }
    if (!email) { setAlert(signupError, "이메일을 입력해주세요."); return; }
    if (password.length < 6) { setAlert(signupError, "비밀번호는 6자 이상 입력해주세요."); return; }
    if (password !== password2) { setAlert(signupError, "비밀번호가 일치하지 않습니다."); return; }
    if (!grade || !classNo || !studentNo) { setAlert(signupError, "학년, 반, 번호를 모두 입력해주세요."); return; }
    setBusy(btn, true, "회원가입");
    var res = await sb.auth.signUp({
      email: email,
      password: password,
      options: { data: { name: name, grade: grade, class_no: classNo, student_no: studentNo } }
    });
    setBusy(btn, false, "회원가입");
    if (res.error) { setAlert(signupError, translateError(res.error.message)); return; }
    signupForm.reset();
    if (res.data.session) {
      closeModal();
      showToast("회원가입이 완료되었습니다. 환영합니다!", "success");
    } else {
      setAlert(signupOk, "회원가입 완료! 이메일로 전송된 인증 메일을 확인한 후 로그인해주세요.");
      switchTab("login");
      document.getElementById("loginEmail").value = email;
    }
  });

  logoutBtn.addEventListener("click", async function (e) {
    e.preventDefault();
    await sb.auth.signOut();
    showToast("로그아웃되었습니다.");
  });

  var githubBtn = document.getElementById("githubLoginBtn");

  if (githubBtn) {
    githubBtn.addEventListener("click", async function () {
      githubBtn.disabled = true;
      var options = {};
      if (window.location.protocol === "http:" || window.location.protocol === "https:") {
        options.redirectTo = window.location.origin + window.location.pathname;
      }
      var res = await sb.auth.signInWithOAuth({ provider: "github", options: options });
      if (res.error) {
        githubBtn.disabled = false;
        showToast("GitHub 로그인에 실패했습니다: " + res.error.message, "error");
      }
    });
  }
})();
