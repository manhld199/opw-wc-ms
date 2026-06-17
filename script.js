const GAS_URL =
  "https://script.google.com/macros/s/AKfycbym9V4LdU7HxPPHL9CzxheBkqrauwKqQLnmxpwqjMeT0WBJaZvcmAUpPyQonNqA8wfT/exec";

let currentUserEmail = "";
let currentTab = "active"; // Các trạng thái: "active", "past", hoặc "leaderboard"

// Mảng lưu trữ dữ liệu các trận đấu đang được chọn (để phục vụ search/filter)
let currentMatchesData = [];

// Feature 1: Countdown intervals tracker (stt -> intervalId)
var countdownIntervals = {};
// Feature 8: Match data cache for detail modal (stt -> rowArray)
var matchDataCache = {};

// Auto login check on page load
document.addEventListener("DOMContentLoaded", () => {
  const savedEmail = localStorage.getItem("currentUserEmail");
  const savedName = localStorage.getItem("currentUserName");
  if (savedEmail) {
    currentUserEmail = savedEmail;

    // Display stored info immediately to prevent flashing blank UI
    document.getElementById("userInfo").innerHTML = `
      <span>⚽ <b>Người chơi:</b> ${savedName || 'Đang tải...'}</span> 
      <span style="color: #a0aec0">|</span> 
      <span>📧 <b>Email:</b> ${savedEmail}</span>
      <button class="logout-btn" onclick="logout()">Đăng xuất</button>
    `;

    document.getElementById("loginSectionWrapper").style.display = "none";
    document.getElementById("userInfo").style.display = "flex";
    document.getElementById("tabContainer").style.display = "flex";

    // Mặc định ban đầu hiển thị bảng trận đấu
    document.getElementById("mainTable").style.display = "table";
    document.getElementById("filterContainer").style.display = "flex";
    document.getElementById("leaderboardTable").style.display = "none";

    loadData();
    loadMyStats(); // Feature 6: load stats card
  }
});


function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  currentUserEmail = payload.email;

  // Save login session
  localStorage.setItem("currentUserEmail", payload.email);
  localStorage.setItem("currentUserName", payload.name || "");

  document.getElementById("loginSectionWrapper").style.display = "none";
  document.getElementById("userInfo").style.display = "flex";
  document.getElementById("tabContainer").style.display = "flex";

  // Mặc định ban đầu hiển thị bảng trận đấu
  document.getElementById("mainTable").style.display = "table";
  document.getElementById("filterContainer").style.display = "flex";
  document.getElementById("leaderboardTable").style.display = "none";

  loadData();
  showWarningModal();
  loadMyStats(); // Feature 6: load stats card
}

// GIỮ NGUYÊN HÀM APICALL GỐC DÙNG FORMDATA CỦA BẠN
async function apiCall(action, params = {}) {
  const formData = new URLSearchParams();

  formData.append("action", action);
  formData.append("email", currentUserEmail);

  Object.keys(params).forEach((key) => {
    formData.append(key, params[key]);
  });

  const response = await fetch(GAS_URL, {
    method: "POST",
    body: formData,
  });

  return await response.json();
}

// HÀM SWITCH TAB CẬP NHẬT 3 NÚT ĐIỀU HƯỚNG
function switchTab(tabName) {
  if (currentTab === tabName) return;
  currentTab = tabName;

  // Cập nhật trạng thái active UI của nút tab
  document.getElementById("btnActiveMatches").classList.toggle("active", tabName === "active");
  document.getElementById("btnPastMatches").classList.toggle("active", tabName === "past");
  document.getElementById("btnLeaderboard").classList.toggle("active", tabName === "leaderboard");

  // Xử lý ẩn hiện bảng phù hợp với tab được chọn
  if (tabName === "leaderboard") {
    document.getElementById("mainTable").style.display = "none";
    document.getElementById("filterContainer").style.display = "none";
    document.getElementById("leaderboardTable").style.display = "table";
    loadLeaderboardData();
  } else {
    document.getElementById("mainTable").style.display = "table";
    document.getElementById("filterContainer").style.display = "flex";
    document.getElementById("leaderboardTable").style.display = "none";
    
    // Reset filters
    document.getElementById("searchInput").value = "";
    document.getElementById("statusFilter").value = "all";
    loadData();
  }
}

function loadData(showLoading = true) {
  if (showLoading) showLoader();
  clearAllCountdowns(); // Feature 1: clear tất cả countdown đang chạy
  matchDataCache = {};   // Feature 8: reset cache trận

  // Lấy thông tin user
  apiCall("getUserInfo")
    .then((user) => {
      // Sync names to localstorage in case it changed
      localStorage.setItem("currentUserName", user.name || "");
      document.getElementById("userInfo").innerHTML = `
        <span>⚽ <b>Người chơi:</b> ${user.name}</span> 
        <span style="color: #a0aec0">|</span> 
        <span>📧 <b>Email:</b> ${user.email}</span>
        <button class="logout-btn" onclick="logout()">&#x0110;ăng xuất</button>
      `;
    })
    .catch(console.error);

  // Xác định action API cần gọi dựa vào Tab hiện tại
  const targetAction = currentTab === "active" ? "getMatches" : "getPastMatches";

  apiCall(targetAction)
    .then((data) => {
      currentMatchesData = data;
      renderMatches();
      hideLoader(); // Tắt loader khi render xong
    })
    .catch((err) => {
      console.error(err);
      hideLoader(); // Tắt loader khi có lỗi
    });
}

function applyFilters() {
  renderMatches();
}

function renderMatches() {
  var tbody = document.getElementById("matchBody");
  tbody.innerHTML = "";
  
  clearAllCountdowns(); // Xóa countdown cũ trước khi render lại
  matchDataCache = {};  // Reset cache trận đấu để build lại

  // Quản lý hiển thị cột Kết quả và Countdown trên thead
  if (currentTab === "past") {
    document.getElementById("thResult").style.display    = "table-cell";
    document.getElementById("thCountdown").style.display = "none";
  } else {
    document.getElementById("thResult").style.display    = "none";
    document.getElementById("thCountdown").style.display = "table-cell";
  }

  // Lấy giá trị filter
  var searchTerm = (document.getElementById("searchInput").value || "").toLowerCase().trim();
  var statusFilter = document.getElementById("statusFilter").value || "all";

  // Lọc dữ liệu
  var filteredData = currentMatchesData.filter(row => {
    var homeTeam  = String(row[4]  || "").trim();
    var awayTeam  = String(row[5]  || "").trim();
    var betValue    = String(row[16] || "").trim();
    var winningTeam = String(row[10] || "").trim();
    var upperTeam   = String(row[12] || "").trim();
    
    // 1. Lọc theo search (Tên đội)
    if (searchTerm !== "") {
      if (!homeTeam.toLowerCase().includes(searchTerm) && !awayTeam.toLowerCase().includes(searchTerm)) {
        return false;
      }
    }

    // 2. Lọc theo trạng thái
    if (statusFilter !== "all") {
      var actualWinningChoice = "";
      if (winningTeam) {
        actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
      }

      if (statusFilter === "unbet") {
        if (betValue !== "") return false;
      } else if (statusFilter === "bet") {
        if (betValue === "") return false;
      } else if (statusFilter === "win") {
        if (currentTab !== "past" || betValue === "" || actualWinningChoice !== betValue) return false;
      } else if (statusFilter === "lose") {
        // Có chọn nhưng khác kết quả
        if (currentTab !== "past" || betValue === "" || actualWinningChoice === betValue || !actualWinningChoice) return false;
      } else if (statusFilter === "wait") {
        // Past match nhưng chưa có kết quả
        if (currentTab !== "past" || actualWinningChoice !== "") return false;
      }
    }

    return true;
  });

  if (filteredData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 30px; color: #718096;">Không có trận đấu nào phù hợp với bộ lọc.</td></tr>`;
    return;
  }

  filteredData.forEach((row) => {
    // Sheet columns (0-indexed): [0]=STT, [3]=Thời gian, [4]=Chủ nhà, [5]=Đội khách
    // [6]=Bàn thắng chủ nhà, [7]=Bàn thắng đội khách, [8]=Trạng thái
    // [10]=Đội thắng kèo (Cột K), [12]=Cửa trên (Cột M), [13]=Lý do chấp
    // [16]=lựa chọn của user (pushed by API)
    var homeTeam  = String(row[4]  || "").trim();
    var awayTeam  = String(row[5]  || "").trim();
    var homeScore = row[6] !== "" ? row[6] : "";
    var awayScore = row[7] !== "" ? row[7] : "";
    var scoreDisplay = (homeScore !== "" && awayScore !== "") ? ` <span style="color:#e53e3e; font-weight:bold;">${homeScore} - ${awayScore}</span> ` : " vs ";
    var matchTitle = `${homeTeam}${scoreDisplay}${awayTeam}`;

    var betValue    = String(row[16] || "").trim();
    var winningTeam = String(row[10] || "").trim();
    var upperTeam   = String(row[12] || "").trim();
    var lowerTeam   = upperTeam === homeTeam ? awayTeam : homeTeam;

    // Quy đổi tên đội thắng thành Cửa trên / Cửa dưới
    var actualWinningChoice = "";
    if (winningTeam) {
      actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
    }

    var isDisabled = currentTab === "past" ? "disabled" : "";

    // Kết quả badge (past tab)
    var resultHtml = "";
    if (currentTab === "past") {
      var badgeClass = "status-wait";
      var badgeText  = "⏳ Chờ KQ";
      if (actualWinningChoice) {
        if (betValue === "") {
          badgeClass = "status-lose";
          badgeText  = "❌ Không chọn";
        } else if (actualWinningChoice === betValue) {
          badgeClass = "status-win";
          badgeText  = "✅ Thắng";
        } else {
          badgeClass = "status-lose";
          badgeText  = "❌ Thua";
        }
      }
      resultHtml = `<td data-label="Kết quả"><span class="status-badge ${badgeClass}">${badgeText}</span></td>`;
    }

    // Feature 1: Countdown td (chỉ active tab)
    var countdownHtml = currentTab === "active"
      ? `<td class="countdown-cell" data-label="Còn lại" id="cd-${row[0]}">⏱...</td>`
      : "";

    // Feature 4: Highlight trận chưa chọn (chỉ active tab, bỏ trống betValue)
    var unbetClass = (currentTab === "active" && betValue === "") ? "row-unbet" : "";
    var unbetIcon  = (currentTab === "active" && betValue === "")
      ? ` <span class="unbet-icon" title="Bạn chưa chọn kèo!">&#x26A0;&#xFE0F;</span>`
      : "";

    // Feature 8: Clickable row cho past tab + cache data
    var trAttrs;
    if (currentTab === "past") {
      matchDataCache[row[0]] = row;
      trAttrs = `class="clickable-row" onclick="openMatchDetail(${row[0]})"`;
    } else {
      trAttrs = unbetClass ? `class="${unbetClass}"` : "";
    }

    tbody.innerHTML += `
      <tr ${trAttrs}>
        <td data-label="STT">${row[0]}</td>
        <td data-label="Thời gian">${row[3]}</td>
        <td data-label="Trận đấu">${matchTitle}${unbetIcon}</td>
        <td data-label="Cửa trên">${upperTeam}</td>
        <td data-label="Chấp">${row[13]}</td>
        ${countdownHtml}
        <td data-label="Chọn Cửa trên">
          <button
            class="btn ${betValue === "Cửa trên" ? "selected" : ""}"
            ${isDisabled}
            id="btn-u-${row[0]}"
            onclick="bet(this, ${row[0]}, 'Cửa trên')">
            &#x25B2; ${upperTeam}
          </button>
        </td>
        <td data-label="Chọn Cửa dưới">
          <button
            class="btn ${betValue === "Cửa dưới" ? "selected" : ""}"
            ${isDisabled}
            id="btn-d-${row[0]}"
            onclick="bet(this, ${row[0]}, 'Cửa dưới')">
            &#x25BC; ${lowerTeam}
          </button>
        </td>
        ${resultHtml}
      </tr>
    `;
  });

  // Feature 1: Khởi động countdown cho tất cả trận active sau khi render xong
  if (currentTab === "active") {
    filteredData.forEach((row) => {
      var tdEl = document.getElementById("cd-" + row[0]);
      if (!tdEl) return;
      var btnU = document.getElementById("btn-u-" + row[0]);
      var btnD = document.getElementById("btn-d-" + row[0]);
      startCountdown(row[0], row[3], [btnU, btnD].filter(Boolean), tdEl);
    });
  }
}

// THÊM MỚI HÀM ĐỔ DỮ LIỆU BẢNG VÀNG
function loadLeaderboardData() {
  showLoader();
  var tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">⏳ Đang tải bảng điểm...</td></tr>`;

  apiCall("getLeaderboard")
    .then((data) => {
      tbody.innerHTML = "";

      if (!data || data.error || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#e53e3e;">Không thể tải dữ liệu hoặc bảng trống!</td></tr>`;
        hideLoader();
        return;
      }

      // Tự động sort theo hạng tăng dần
      data.sort((a, b) => Number(a.rank) - Number(b.rank));

      data.forEach((player) => {
        // Định dạng hiển thị % từ số thập phân (ví dụ 0.75 -> 75.0%)
        let winRateFormatted =
          typeof player.winRate === "number"
            ? (player.winRate * 100).toFixed(1) + "%"
            : player.winRate;

        // Phân cấp hàng dựa trên thứ hạng hoặc điểm âm để đồng bộ CSS
        let highlightClass = "";
        if (player.rank == 1) highlightClass = "top-1";
        else if (player.rank == 2) highlightClass = "top-2";
        else if (Number(player.totalScore) < 0) highlightClass = "negative-score";

        tbody.innerHTML += `
          <tr class="${highlightClass}">
            <td data-label="Hạng" class="rank-col"><b>${player.rank}</b></td>
            <td data-label="Thành viên"><b>${player.name}</b></td>
            <td data-label="Tổng điểm" class="score-col">${player.totalScore}</td>
            <td data-label="Trận đúng" style="color: #2e7d32; font-weight:600;">${player.winMatches}</td>
            <td data-label="Trận sai" style="color: #e53e3e; font-weight:600;">${player.loseMatches}</td>
            <td data-label="Tỷ lệ thắng">${winRateFormatted}</td>
            <td data-label="Chuỗi thắng Max">${player.maxWinStreak}</td>
          </tr>
        `;
      });
      hideLoader();
    })
    .catch((err) => {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#e53e3e;">Có lỗi xảy ra khi kết nối đồng bộ!</td></tr>`;
      hideLoader();
    });
}

function showLoader() {
  document.getElementById("fullScreenLoader").style.display = "flex";
}

function hideLoader() {
  document.getElementById("fullScreenLoader").style.display = "none";
}

function bet(btn, stt, choice) {
  // Chặn trường hợp kích hoạt cược nhầm khi không ở tab active
  if (currentTab === "past" || currentTab === "leaderboard") return;

  const originalText = btn.innerText;
  btn.innerText = "⏳...";

  apiCall("submitBet", {
    stt: stt,
    choice: choice,
  })
    .then((res) => {
      showToast(typeof res === "string" ? res : JSON.stringify(res));
      loadData(false);
    })
    .catch((err) => {
      console.error(err);
      showToast("Có lỗi xảy ra");
      btn.innerText = originalText;
    });
}

function showToast(msg) {
  var x = document.getElementById("toast");

  x.innerText = msg;
  x.className = "show";

  setTimeout(() => {
    x.className = x.className.replace("show", "");
  }, 3000);
}

function showWarningModal() {
  const modal = document.getElementById("warningModal");
  if (modal) {
    modal.style.display = "flex";
    // Force reflow to allow transition to trigger
    modal.offsetHeight;
    modal.classList.add("show");
  }
}

function closeWarningModal() {
  const modal = document.getElementById("warningModal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.style.display = "none";
    }, 300); // Wait for transition fade out (300ms)
  }
}

function logout() {
  localStorage.removeItem("currentUserEmail");
  localStorage.removeItem("currentUserName");
  window.location.reload();
}


// =====================================================================
// FEATURE 1: COUNTDOWN TIMER
// =====================================================================

function clearAllCountdowns() {
  Object.keys(countdownIntervals).forEach(function(stt) {
    clearInterval(countdownIntervals[stt]);
  });
  countdownIntervals = {};
}

function parseMatchTime(timeStr) {
  if (!timeStr) return null;
  var s = String(timeStr);

  // Format chính: "DD/MM/YYYY HH:mm" (hiển thị giờ Việt Nam)
  var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    // Khởi tạo theo local time (user ở Việt Nam)
    return new Date(
      parseInt(m[3]),
      parseInt(m[2]) - 1,
      parseInt(m[1]),
      parseInt(m[4]),
      parseInt(m[5])
    );
  }

  // Fallback: thử parse tự động (ISO string từ GAS)
  var d = new Date(timeStr);
  return isNaN(d.getTime()) ? null : d;
}

function startCountdown(stt, matchTimeStr, buttons, tdEl) {
  var matchTime = parseMatchTime(matchTimeStr);
  if (!matchTime) {
    tdEl.innerHTML = '<span class="cd-unknown">--</span>';
    return;
  }

  // Khóa cược 1 tiếng trước giờ đá (giống backend validation)
  var lockTime = new Date(matchTime.getTime() - 60 * 60 * 1000);

  function tick() {
    var now  = new Date();
    var diff = lockTime - now;

    if (diff <= 0) {
      // Hết giờ: khóa nút và hiển thị badge
      tdEl.innerHTML = '<span class="cd-locked">🔒 Đã khóa</span>';
      buttons.forEach(function(btn) { btn.disabled = true; });
      clearInterval(countdownIntervals[stt]);
      delete countdownIntervals[stt];
      return;
    }

    var totalSecs = Math.floor(diff / 1000);
    var h = Math.floor(totalSecs / 3600);
    var mi = Math.floor((totalSecs % 3600) / 60);
    var s = totalSecs % 60;

    var display, cls;
    if (h >= 24) {
      var days = Math.floor(h / 24);
      display = days + 'ngày ' + (h % 24) + 'h';
      cls = 'cd-safe';
    } else if (h > 0) {
      display = h + 'h ' + String(mi).padStart(2, '0') + 'm';
      cls = h >= 3 ? 'cd-safe' : 'cd-warning';
    } else {
      display = String(mi).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's';
      cls = 'cd-urgent';
    }

    tdEl.innerHTML = '<span class="' + cls + '">⏱ ' + display + '</span>';
  }

  tick(); // Chạy ngay lần đầu
  countdownIntervals[stt] = setInterval(tick, 1000);
}


// =====================================================================
// FEATURE 5: MANUAL REFRESH BUTTON
// =====================================================================

function manualRefresh() {
  var btn = document.getElementById('btnRefresh');
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  btn.classList.add('refreshing');

  if (currentTab === 'leaderboard') {
    loadLeaderboardData();
  } else {
    loadData(true);
  }

  // Cho phép bấm lại sau 2 giây (tránh spam)
  setTimeout(function() {
    btn.disabled = false;
    btn.classList.remove('refreshing');
  }, 2000);
}


// =====================================================================
// FEATURE 6: MY STATS CARD
// =====================================================================

function loadMyStats() {
  var currentName = localStorage.getItem("currentUserName");
  if (!currentName) return;

  apiCall("getLeaderboard")
    .then(function(data) {
      if (!data || data.error || !Array.isArray(data)) return;

      // Tìm người chơi hiện tại theo tên (khớp với Bảng vàng)
      var me = data.find(function(p) {
        return String(p.name).trim() === String(currentName).trim();
      });

      if (!me) return;

      var winRate = typeof me.winRate === "number"
        ? (me.winRate * 100).toFixed(0) + "%"
        : String(me.winRate || "--");

      document.getElementById("statRank").textContent  = "#" + me.rank;
      document.getElementById("statWin").textContent   = me.winMatches;
      document.getElementById("statLose").textContent  = me.loseMatches;
      document.getElementById("statRate").textContent  = winRate;

      // Hiển thị điểm và tô màu theo dương/âm
      var scoreEl = document.getElementById("statScore");
      var score = Number(me.totalScore);
      scoreEl.textContent = (score >= 0 ? "+" : "") + score;
      scoreEl.style.color = score >= 0 ? "#2e7d32" : "#e53e3e";

      document.getElementById("myStatsCard").style.display = "flex";
    })
    .catch(console.error);
}


// =====================================================================
// FEATURE 8: MATCH DETAIL MODAL
// =====================================================================

function openMatchDetail(stt) {
  var row = matchDataCache[stt];
  if (!row) return;

  var homeTeam    = String(row[4]  || "").trim();
  var awayTeam    = String(row[5]  || "").trim();
  var homeScore   = row[6] !== "" ? row[6] : "";
  var awayScore   = row[7] !== "" ? row[7] : "";
  var upperTeam   = String(row[12] || "").trim();
  var lowerTeam   = upperTeam === homeTeam ? awayTeam : homeTeam;
  var handicap    = row[13];
  var betValue    = String(row[16] || "").trim();
  var winningTeam = String(row[10] || "").trim();

  var actualWinningChoice = winningTeam
    ? (winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới")
    : "";

  // Tiêu đề modal
  var scoreStr = (homeScore !== "" && awayScore !== "")
    ? `<span style="color:#e53e3e;font-weight:800;">${homeScore} – ${awayScore}</span>`
    : `<span style="color:#718096">vs</span>`;
  document.getElementById("detailMatchTitle").innerHTML =
    `${homeTeam} &nbsp;${scoreStr}&nbsp; ${awayTeam}`;

  // Badge kết quả của bản thân
  var myResultBadge;
  if (!actualWinningChoice) {
    myResultBadge = '<span class="status-badge status-wait">⏳ Chờ KQ</span>';
  } else if (!betValue) {
    myResultBadge = '<span class="status-badge status-lose">❌ Không chọn</span>';
  } else if (betValue === actualWinningChoice) {
    myResultBadge = '<span class="status-badge status-win">✅ Thắng</span>';
  } else {
    myResultBadge = '<span class="status-badge status-lose">❌ Thua</span>';
  }

  var myChoiceLabel = betValue === "Cửa trên" ? "▲ " + upperTeam
    : betValue === "Cửa dưới" ? "▼ " + lowerTeam
    : "Chưa chọn";

  var resultLabel = actualWinningChoice === "Cửa trên" ? "▲ " + upperTeam
    : actualWinningChoice === "Cửa dưới" ? "▼ " + lowerTeam
    : "Chưa có";

  document.getElementById("detailMatchInfo").innerHTML = `
    <div class="detail-info-grid">
      <div class="detail-info-item">
        <span class="detail-info-label">Cửa trên</span>
        <span class="detail-info-value">▲ ${upperTeam}</span>
      </div>
      <div class="detail-info-item">
        <span class="detail-info-label">Tỷ lệ chấp</span>
        <span class="detail-info-value handicap-val">${handicap}</span>
      </div>
      <div class="detail-info-item">
        <span class="detail-info-label">Bạn chọn</span>
        <span class="detail-info-value">${myChoiceLabel}</span>
      </div>
      <div class="detail-info-item">
        <span class="detail-info-label">Kết quả kèo</span>
        <span class="detail-info-value">${resultLabel}</span>
      </div>
    </div>
    <div class="detail-my-result">${myResultBadge}</div>
  `;

  // Reset và hiển thị modal
  document.getElementById("detailVotesList").innerHTML =
    '<div style="text-align:center; padding: 20px; color: #718096;">⏳ Đang tải bình chọn...</div>';

  var modal = document.getElementById("matchDetailModal");
  modal.style.display = "flex";
  modal.offsetHeight; // force reflow
  modal.classList.add("show");

  // Gọi API lấy bình chọn của tất cả mọi người
  apiCall("getMatchDetail", { stt: stt })
    .then(function(votes) {
      if (!votes || votes.error) {
        document.getElementById("detailVotesList").innerHTML =
          '<p style="color:#e53e3e;text-align:center;padding:16px;">Không thể tải dữ liệu bình chọn.</p>';
        return;
      }

      // Tính tổng hợp
      var upperCount = votes.filter(function(v) { return v.choice === "Cửa trên"; }).length;
      var lowerCount = votes.filter(function(v) { return v.choice === "Cửa dưới"; }).length;
      var total = votes.length;
      var upperPct = total > 0 ? Math.round(upperCount / total * 100) : 0;
      var lowerPct = total > 0 ? Math.round(lowerCount / total * 100) : 0;

      // Thanh progress bar tổng hợp
      var summaryHtml = `
        <div class="vote-summary">
          <div class="vote-bar-row">
            <span class="vote-bar-team">▲ ${upperTeam}</span>
            <div class="vote-bar-track"><div class="vote-bar-fill upper-fill" style="width:${upperPct}%"></div></div>
            <span class="vote-bar-count">${upperCount} người (${upperPct}%)</span>
          </div>
          <div class="vote-bar-row">
            <span class="vote-bar-team">▼ ${lowerTeam}</span>
            <div class="vote-bar-track"><div class="vote-bar-fill lower-fill" style="width:${lowerPct}%"></div></div>
            <span class="vote-bar-count">${lowerCount} người (${lowerPct}%)</span>
          </div>
        </div>
      `;

      // Grid card từng người
      var votesHtml = '<div class="votes-grid">';
      votes.forEach(function(v) {
        var isCorrect = actualWinningChoice && v.choice === actualWinningChoice;
        var isWrong   = actualWinningChoice && v.choice && v.choice !== actualWinningChoice;
        var choiceLabel = v.choice === "Cửa trên" ? "▲ " + upperTeam
          : v.choice === "Cửa dưới" ? "▼ " + lowerTeam
          : "—";
        var choiceClass = v.choice === "Cửa trên" ? "vote-upper"
          : v.choice === "Cửa dưới" ? "vote-lower"
          : "vote-none";
        var cardClass = isCorrect ? "vote-card-correct" : isWrong ? "vote-card-wrong" : "";

        votesHtml += `
          <div class="vote-card ${cardClass}">
            <div class="vote-name">${v.name}</div>
            <div class="vote-choice ${choiceClass}">${choiceLabel}</div>
          </div>
        `;
      });
      votesHtml += '</div>';

      document.getElementById("detailVotesList").innerHTML = summaryHtml + votesHtml;
    })
    .catch(function(err) {
      console.error(err);
      document.getElementById("detailVotesList").innerHTML =
        '<p style="color:#e53e3e;text-align:center;padding:16px;">Có lỗi xảy ra khi tải dữ liệu.</p>';
    });
}

function closeMatchDetail() {
  var modal = document.getElementById("matchDetailModal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(function() { modal.style.display = "none"; }, 300);
  }
}
