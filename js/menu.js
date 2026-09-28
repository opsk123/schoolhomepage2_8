(function () {
  "use strict";

  var meals = {
    1: ["혼합잡곡밥", "삼색냉묵사발", "안동찜닭", "사과무생채"],
    2: ["통영장어스테이크", "유부미소된장국", "메추리알곤약조림", "보코치니샐러드"],
    3: ["흑미밥", "오징어무국", "조밥·마늘소스", "다시마채무침"],
    4: ["기장밥", "부대찌개", "양념꼬리찜", "열대과일샐러드"],
    7: ["흑미밥", "매콤어묵국", "꼬봉이야채무침", "열무나물"],
    8: ["혼합잡곡밥", "육개장", "오이깍두기", "이북식기름떡볶이"],
    9: ["양배추샐러드", "후라이드치킨", "배추김치", "골드파인애플"],
    10: ["간장버터진미채주먹밥", "우동", "단무지", "양상추샐러드"],
    11: ["흑미밥", "돈등뼈감자탕", "가지나물", "아삭고추쌈장무침"],
    12: ["짜장밥", "짬뽕국", "단무지", "군만두·초간장"],
    14: ["토마토스파게티", "마늘빵", "그린샐러드·유자드레싱", "오이피클"],
    15: ["기장밥", "감자국", "도토리묵무침", "버섯잡채"],
    16: ["돼지국밥", "부추겉절이", "마늘종어묵볶음", "깻잎튀김"],
    17: ["카레돈까스덮밥", "마들렌", "미소된장국", "카프레제샐러드"],
    18: ["백미밥(중식)", "잔치국수", "김자반", "스윗초코순살치킨"],
    19: ["기장밥", "부산어묵국", "쪽파무생채", "건취나물볶음"],
    20: ["백미밥(중식)", "청양시락국", "노르웨이북어볶음", "돈육모듬볶음"],
    21: ["기장밥", "토종순대국", "아삭고추쌈장무침", "사각어묵볶음"],
    22: ["흑미밥", "들깨새우채국", "불족발수육볶음", "양배추쌈", "양갱채무침"],
    23: ["혼합잡곡밥", "한우무국", "두부양념장", "꽁치김치조림"],
    28: ["혼합잡곡밥", "근대된장나물", "돈육김치찌개", "명엽채볶음"],
    29: ["카레라이스", "우엉잡채", "오이소박이무침", "멸치고추장볶음"],
    30: ["기장밥", "하우스청귤", "부추겉절이", "아삭고추·양파·쌈장"]
  };

  var holidays = { 24: "추석 연휴", 25: "추석", 26: "추석 연휴" };
  var weekdays = ["월", "화", "수", "목", "금", "토", "일"];
  var calendar = document.getElementById("mealCalendar");
  var selectedDate = document.getElementById("selectedMealDate");
  var selectedList = document.getElementById("selectedMealList");
  var lifeDate = document.getElementById("lifeMealDate");
  var lifeList = document.getElementById("lifeMealList");
  var selectedDay = 29;

  function makeDay(day) {
    var weekday = day % 7;
    var classes = ["meal-day"];
    if (weekday === 5 || weekday === 6) classes.push("is-weekend");

    if (meals[day]) {
      classes.push("has-meal");
      return '<article class="' + classes.join(" ") + '" data-day="' + day + '">' +
        '<button class="meal-day-button" type="button" aria-pressed="false" aria-label="9월 ' + day + '일 (' + weekdays[weekday] + '요일) 중식 메뉴 선택">' +
        '<span class="meal-day-number">' + day + '</span><span class="meal-day-tag">중식</span></button>' +
        '<ul class="meal-day-list">' + meals[day].map(function (item) { return '<li>' + item + '</li>'; }).join("") + '</ul></article>';
    }

    if (holidays[day]) {
      classes.push("is-holiday");
      return '<article class="' + classes.join(" ") + '"><span class="meal-day-number">' + day + '</span><span class="holiday-label">' + holidays[day] + '</span></article>';
    }

    return '<article class="' + classes.join(" ") + '"><span class="meal-day-number">' + day + '</span></article>';
  }

  function renderCalendar() {
    var markup = '<div class="meal-weekday-row" aria-hidden="true">' + weekdays.map(function (day) {
      return '<span>' + day + '</span>';
    }).join("") + '</div>';
    var offset = 1; // 2026년 9월 1일은 화요일

    for (var week = 0; week < 5; week += 1) {
      markup += '<div class="meal-week">';
      for (var column = 0; column < 7; column += 1) {
        var day = week * 7 + column - offset + 1;
        markup += day > 0 && day <= 30 ? makeDay(day) : '<div class="meal-day is-empty" aria-hidden="true"></div>';
      }
      markup += '</div>';
    }

    calendar.innerHTML = markup;
    calendar.querySelectorAll(".meal-day-button").forEach(function (button) {
      button.addEventListener("click", function () {
        selectDay(Number(button.closest(".meal-day").dataset.day));
      });
    });
  }

  function selectDay(day) {
    if (!meals[day]) return;
    selectedDay = day;
    var weekday = weekdays[day % 7];
    var label = "9월 " + day + "일 (" + weekday + ")";
    selectedDate.textContent = label;
    lifeDate.textContent = label;
    selectedList.innerHTML = meals[day].map(function (item) { return '<li>' + item + '</li>'; }).join("");
    lifeList.innerHTML = meals[day].map(function (item) { return '<li>' + item + '</li>'; }).join("");

    calendar.querySelectorAll(".meal-day").forEach(function (cell) {
      var active = Number(cell.dataset.day) === selectedDay;
      cell.classList.toggle("is-selected", active);
      var button = cell.querySelector(".meal-day-button");
      if (button) button.setAttribute("aria-pressed", String(active));
    });
  }

  renderCalendar();
  selectDay(selectedDay);
})();
