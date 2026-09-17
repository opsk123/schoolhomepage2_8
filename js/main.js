(function () {
  "use strict";

  var slides = document.querySelectorAll(".hero-slide");
  var dotsWrap = document.getElementById("heroDots");
  var prevBtn = document.getElementById("heroPrev");
  var nextBtn = document.getElementById("heroNext");
  var toggleBtn = document.getElementById("heroToggle");
  var current = 0;
  var timer = null;
  var playing = true;
  var INTERVAL = 5000;

  slides.forEach(function (_, i) {
    var dot = document.createElement("button");
    dot.type = "button";
    dot.setAttribute("aria-label", (i + 1) + "번 슬라이드");
    if (i === 0) dot.classList.add("is-active");
    dot.addEventListener("click", function () {
      go(i);
      restart();
    });
    dotsWrap.appendChild(dot);
  });

  var dots = dotsWrap.querySelectorAll("button");

  function go(index) {
    slides[current].classList.remove("is-active");
    dots[current].classList.remove("is-active");
    current = (index + slides.length) % slides.length;
    slides[current].classList.add("is-active");
    dots[current].classList.add("is-active");
  }

  function start() {
    timer = setInterval(function () { go(current + 1); }, INTERVAL);
    playing = true;
    toggleBtn.innerHTML = "&#10074;&#10074;";
    toggleBtn.setAttribute("aria-label", "슬라이드 정지");
  }

  function stop() {
    clearInterval(timer);
    playing = false;
    toggleBtn.innerHTML = "&#9654;";
    toggleBtn.setAttribute("aria-label", "슬라이드 재생");
  }

  function restart() {
    if (playing) { stop(); start(); }
  }

  prevBtn.addEventListener("click", function () { go(current - 1); restart(); });
  nextBtn.addEventListener("click", function () { go(current + 1); restart(); });
  toggleBtn.addEventListener("click", function () {
    if (playing) { stop(); } else { start(); }
  });

  start();

  var tabs = document.querySelectorAll(".tab");
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.classList.remove("is-active");
        t.setAttribute("aria-selected", "false");
        document.getElementById(t.dataset.tab).classList.remove("is-active");
      });
      tab.classList.add("is-active");
      tab.setAttribute("aria-selected", "true");
      document.getElementById(tab.dataset.tab).classList.add("is-active");
    });
  });

  var menuToggle = document.getElementById("menuToggle");
  var gnb = document.getElementById("gnb");

  menuToggle.addEventListener("click", function () {
    var open = gnb.classList.toggle("is-open");
    menuToggle.classList.toggle("is-open", open);
    menuToggle.setAttribute("aria-expanded", open);
    menuToggle.setAttribute("aria-label", open ? "전체 메뉴 닫기" : "전체 메뉴 열기");
  });

  gnb.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", function () {
      gnb.classList.remove("is-open");
      menuToggle.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    });
  });

  var counted = false;
  var counters = document.querySelectorAll("[data-count]");

  function animateCounters() {
    if (counted) return;
    var stats = document.getElementById("stats");
    if (!stats) return;
    var rect = stats.getBoundingClientRect();
    if (rect.top > window.innerHeight * 0.85) return;
    counted = true;
    counters.forEach(function (el) {
      var target = parseInt(el.dataset.count, 10);
      var start = null;
      var DURATION = 1500;
      function step(ts) {
        if (!start) start = ts;
        var progress = Math.min((ts - start) / DURATION, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  window.addEventListener("scroll", animateCounters, { passive: true });
  animateCounters();

  var toTop = document.getElementById("toTop");

  window.addEventListener("scroll", function () {
    toTop.classList.toggle("is-visible", window.scrollY > 400);
  }, { passive: true });

  toTop.addEventListener("click", function () {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
})();
