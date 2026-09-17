(function () {
  "use strict";

  var grid = document.getElementById("clubsGrid");
  var myAppsSection = document.getElementById("myApps");
  var myAppsBody = document.getElementById("myAppsBody");
  var myAppsTitle = document.getElementById("myAppsTitle");
  var authNotice = document.getElementById("clubAuthNotice");

  if (!grid || !window.sb) return;

  var STATUS_LABEL = { pending: "승인 대기", approved: "승인 완료", rejected: "거절" };
  var clubs = [];
  var myApps = [];
  var counts = {};
  var user = null;
  var profileName = "";
  var lastUserId;

  function clubById(id) {
    for (var i = 0; i < clubs.length; i++) {
      if (clubs[i].id === id) return clubs[i];
    }
    return null;
  }

  function appFor(clubId) {
    for (var i = 0; i < myApps.length; i++) {
      if (myApps[i].club_id === clubId) return myApps[i];
    }
    return null;
  }

  async function loadClubsData() {
    var res = await sb.from("clubs").select("*").eq("is_open", true).order("id", { ascending: true });
    if (res.error) {
      clubs = [];
      grid.innerHTML = '<p class="apps-empty">동아리 목록을 불러올 수 없습니다. Supabase 설정(schema.sql 실행 여부)을 확인해주세요.</p>';
      return;
    }
    clubs = res.data || [];
    counts = {};
    var stats = await sb.rpc("club_counts");
    if (!stats.error && Array.isArray(stats.data)) {
      stats.data.forEach(function (row) {
        counts[row.club_id] = {
          approved: Number(row.approved_count) || 0,
          pending: Number(row.pending_count) || 0
        };
      });
    }
  }

  async function loadMyAppsData() {
    var res = await sb.from("club_applications")
      .select("id, club_id, status, created_at, clubs(name, category)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (res.error) {
      myApps = [];
      showToast("신청 내역을 불러오지 못했습니다: " + res.error.message, "error");
      return;
    }
    myApps = res.data || [];
  }

  async function refresh() {
    var jobs = [loadClubsData()];
    if (user) jobs.push(loadMyAppsData());
    else myApps = [];
    await Promise.all(jobs);
    render();
  }

  function render() {
    renderCards();
    renderMyApps();
    authNotice.hidden = !!user;
    myAppsSection.hidden = !user;
  }

  function renderCards() {
    if (!clubs.length) {
      grid.innerHTML = '<p class="apps-empty">현재 모집 중인 동아리가 없습니다.</p>';
      return;
    }
    grid.innerHTML = clubs.map(cardHtml).join("");
  }

  function cardHtml(club) {
    var stat = counts[club.id] || { approved: 0, pending: 0 };
    var app = appFor(club.id);
    var full = stat.approved >= club.max_members;
    var action;

    if (!user) {
      action = '<button type="button" class="btn btn-outline club-btn" data-auth-open="login">로그인 후 신청</button>';
    } else if (app && app.status === "pending") {
      action = '<span class="badge badge-pending">승인 대기</span>' +
        '<button type="button" class="club-cancel" data-action="cancel" data-app-id="' + app.id + '">신청 취소</button>';
    } else if (app && app.status === "approved") {
      action = '<span class="badge badge-approved">승인 완료</span>';
    } else if (app && app.status === "rejected") {
      action = '<span class="badge badge-rejected">거절</span>' +
        '<button type="button" class="club-cancel" data-action="reapply" data-app-id="' + app.id + '" data-club="' + club.id + '">다시 신청</button>';
    } else if (full) {
      action = '<span class="badge badge-closed">모집 마감</span>';
    } else {
      action = '<button type="button" class="btn btn-solid club-btn" data-action="apply" data-club="' + club.id + '">신청하기</button>';
    }

    return '<article class="club-card">' +
      '<span class="club-cat">' + esc(club.category) + '</span>' +
      '<h3>' + esc(club.name) + '</h3>' +
      '<p>' + esc(club.description) + '</p>' +
      '<div class="club-meta"><span>모집 정원 ' + club.max_members + '명</span><span>승인 ' + stat.approved + '명</span></div>' +
      '<div class="club-actions">' + action + '</div>' +
      '</article>';
  }

  function renderMyApps() {
    myAppsTitle.textContent = user
      ? (profileName || "회원") + "님의 신청 내역 (" + myApps.length + "건)"
      : "내 신청 내역";
    if (!myApps.length) {
      myAppsBody.innerHTML = '<tr><td colspan="5" class="apps-empty">신청한 동아리가 없습니다. 위 목록에서 신청해보세요!</td></tr>';
      return;
    }
    myAppsBody.innerHTML = myApps.map(function (app) {
      var club = clubById(app.club_id);
      var name = app.clubs ? app.clubs.name : (club ? club.name : "-");
      var cat = app.clubs ? app.clubs.category : (club ? club.category : "");
      var date = app.created_at ? app.created_at.slice(0, 10).replace(/-/g, ".") : "-";
      var manage = app.status === "pending"
        ? '<button type="button" class="club-cancel" data-action="cancel" data-app-id="' + app.id + '">취소</button>'
        : "-";
      return '<tr>' +
        '<td>' + esc(name) + '</td>' +
        '<td>' + esc(cat) + '</td>' +
        '<td>' + date + '</td>' +
        '<td><span class="badge badge-' + app.status + '">' + STATUS_LABEL[app.status] + '</span></td>' +
        '<td>' + manage + '</td>' +
        '</tr>';
    }).join("");
  }

  async function applyToClub(clubId, btn) {
    var club = clubById(clubId);
    if (!club || !user) return;
    var stat = counts[clubId] || { approved: 0 };
    if (stat.approved >= club.max_members) {
      showToast("모집 인원이 가득 찼습니다.", "error");
      refresh();
      return;
    }
    if (btn) { btn.disabled = true; btn.textContent = "신청 중..."; }
    var res = await sb.from("club_applications").insert({ club_id: clubId, user_id: user.id });
    if (btn) { btn.disabled = false; btn.textContent = "신청하기"; }
    if (res.error) {
      if (res.error.code === "23505") showToast("이미 신청한 동아리입니다.", "error");
      else showToast("신청에 실패했습니다: " + res.error.message, "error");
      return;
    }
    showToast(club.name + " 동아리에 신청했습니다. 승인을 기다려주세요.", "success");
    refresh();
  }

  async function cancelApplication(appId) {
    if (!appId || !user) return;
    var res = await sb.from("club_applications").delete().eq("id", appId).eq("user_id", user.id);
    if (res.error) {
      showToast("취소에 실패했습니다: " + res.error.message, "error");
      return;
    }
    showToast("신청을 취소했습니다.");
    refresh();
  }

  async function reapply(appId, clubId, btn) {
    var del = await sb.from("club_applications").delete().eq("id", appId).eq("user_id", user.id);
    if (del.error) {
      showToast("다시 신청에 실패했습니다: " + del.error.message, "error");
      return;
    }
    applyToClub(clubId, btn);
  }

  [grid, myAppsBody].forEach(function (area) {
    area.addEventListener("click", function (e) {
      if (!e.target || !e.target.closest) return;
      var btn = e.target.closest("button[data-action]");
      if (!btn) return;
      var action = btn.dataset.action;
      if (action === "apply") applyToClub(Number(btn.dataset.club), btn);
      else if (action === "cancel") cancelApplication(btn.dataset.appId);
      else if (action === "reapply") reapply(btn.dataset.appId, Number(btn.dataset.club), btn);
    });
  });

  document.addEventListener("auth:change", function (e) {
    var detail = e.detail || {};
    var u = detail.user || null;
    var uid = u ? u.id : null;
    if (uid !== lastUserId) {
      lastUserId = uid;
      user = u;
      profileName = "";
      refresh();
    } else if (detail.profile && detail.profile.name) {
      profileName = detail.profile.name;
      renderMyApps();
    }
  });

  refresh();
})();
