const GAS_URL =
  "https://script.google.com/macros/s/AKfycbym9V4LdU7HxPPHL9CzxheBkqrauwKqQLnmxpwqjMeT0WBJaZvcmAUpPyQonNqA8wfT/exec";

let currentUserEmail = "";
let currentTab = "active"; // Các trạng thái: "active", "past", hoặc "leaderboard"

// Mảng lưu trữ dữ liệu các trận đấu đang được chọn (để phục vụ search/filter)
let currentMatchesData = [];

// Countdown intervals tracker (stt -> intervalId)
var countdownIntervals = {};
// Match data cache for detail modal (stt -> rowArray)
var matchDataCache = {};
// Cache for leaderboard badges
var leaderboardCache = [];

// Auto login check on page load
document.addEventListener("DOMContentLoaded", () => {
  const savedEmail = localStorage.getItem("currentUserEmail");
  const savedName = localStorage.getItem("currentUserName");
  if (savedEmail) {
    currentUserEmail = savedEmail;

    // Display stored info immediately to prevent flashing blank UI
    document.getElementById("userInfo").innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
          <i class="ti ti-user text-2xl text-[#0F5132]"></i>
        </div>
        <div>
          <p class="text-xs font-medium text-gray-400">Welcome back,</p>
          <h2 class="text-base font-bold">${savedName || "Đang tải..."}</h2>
        </div>
      </div>
      <div class="flex items-center gap-6 mt-4 md:mt-0">
        <div class="text-right hidden sm:block">
          <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Account</p>
          <p class="text-sm font-medium text-gray-700">${savedEmail}</p>
        </div>
        <button class="px-4 py-2 border border-red-100 text-red-500 bg-red-50/30 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors" onclick="logout()">
          Đăng xuất
        </button>
      </div>
    `;

    document.getElementById("loginSectionWrapper").style.display = "none";
    document.getElementById("userInfo").style.display = "flex";
    document.getElementById("tabContainer").style.display = "flex";

    // Mặc định ban đầu hiển thị bảng trận đấu
    document.getElementById("mainTable").style.display = "block";
    document.getElementById("leaderboardTable").style.display = "none";

    loadData();
    showWarningModal();
    loadMyStats(); // load stats card
    startLiveScoreAutoRefresh();
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
  document.getElementById("mainTable").style.display = "block";
  document.getElementById("leaderboardTable").style.display = "none";

  loadData();
  showWarningModal();
  loadMyStats(); // load stats card
  startLiveScoreAutoRefresh();
}

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
  const btnActive = document.getElementById("btnActiveMatches");
  const btnPast = document.getElementById("btnPastMatches");
  const btnLeader = document.getElementById("btnLeaderboard");

  btnActive.className = "pb-3 px-1 text-sm whitespace-nowrap transition-all " + 
    (tabName === 'active' ? "font-bold text-[#0F5132] border-b-4 border-[#0F5132]" : "font-semibold text-gray-400 hover:text-gray-600");
    
  btnPast.className = "pb-3 px-1 text-sm whitespace-nowrap transition-all " + 
    (tabName === 'past' ? "font-bold text-[#0F5132] border-b-4 border-[#0F5132]" : "font-semibold text-gray-400 hover:text-gray-600");
    
  btnLeader.className = "pb-3 px-1 text-sm whitespace-nowrap transition-all " + 
    (tabName === 'leaderboard' ? "font-bold text-[#0F5132] border-b-4 border-[#0F5132]" : "font-semibold text-gray-400 hover:text-gray-600");

  // Xử lý ẩn hiện bảng phù hợp với tab được chọn
  if (tabName === "leaderboard") {
    document.getElementById("mainTable").style.display = "none";
    document.getElementById("leaderboardTable").style.display = "block";
    loadLeaderboardData();
  } else {
    document.getElementById("mainTable").style.display = "block";
    document.getElementById("leaderboardTable").style.display = "none";

    // Reset filters
    document.getElementById("searchInput").value = "";
    document.getElementById("statusFilter").value = "all";
    loadData();
  }
}

function loadData(showLoading = true) {
  if (showLoading) showLoader();
  clearAllCountdowns(); // clear tất cả countdown đang chạy
  matchDataCache = {}; // reset cache trận

  // Lấy thông tin user
  apiCall("getUserInfo")
    .then((user) => {
      // Sync names to localstorage in case it changed
      localStorage.setItem("currentUserName", user.name || "");
      document.getElementById("userInfo").innerHTML = `
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
            <i class="ti ti-user text-2xl text-[#0F5132]"></i>
          </div>
          <div>
            <p class="text-xs font-medium text-gray-400">Welcome back,</p>
            <h2 class="text-base font-bold">${user.name}</h2>
          </div>
        </div>
        <div class="flex items-center gap-6 mt-4 md:mt-0">
          <div class="text-right hidden sm:block">
            <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Email Account</p>
            <p class="text-sm font-medium text-gray-700">${user.email}</p>
          </div>
          <button class="px-4 py-2 border border-red-100 text-red-500 bg-red-50/30 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors" onclick="logout()">
            Đăng xuất
          </button>
        </div>
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
  matchDataCache = {}; // Reset cache trận đấu để build lại

  // Lấy giá trị filter
  var searchTerm = (document.getElementById("searchInput").value || "").toLowerCase().trim();
  var statusFilter = document.getElementById("statusFilter").value || "all";

  // Lọc dữ liệu
  var filteredData = currentMatchesData.filter((row) => {
    var homeTeam = String(row[4] || "").trim();
    var awayTeam = String(row[5] || "").trim();
    var betValue = String(row[16] || "").trim();
    var winningTeam = String(row[10] || "").trim();
    var upperTeam = String(row[12] || "").trim();

    // Lọc theo search (Tên đội)
    if (searchTerm !== "") {
      if (
        !homeTeam.toLowerCase().includes(searchTerm) &&
        !awayTeam.toLowerCase().includes(searchTerm)
      ) {
        return false;
      }
    }

    // Lọc theo trạng thái
    if (statusFilter !== "all") {
      var actualWinningChoice = "";
      var matchStatusFilter = String(row[8] || "").trim();
      if (winningTeam && matchStatusFilter.includes("Kết thúc")) {
        var hScoreF = parseFloat(row[6]);
        var aScoreF = parseFloat(row[7]);
        var hCapF = parseFloat(row[13]);
        if (!isNaN(hScoreF) && !isNaN(aScoreF) && !isNaN(hCapF)) {
          var diffF = upperTeam === homeTeam ? hScoreF - aScoreF : aScoreF - hScoreF;
          if (diffF === hCapF) actualWinningChoice = "Hòa";
          else if (diffF > hCapF) actualWinningChoice = "Cửa trên";
          else actualWinningChoice = "Cửa dưới";
        } else {
          if (winningTeam === "Hòa" || winningTeam === "Hòa kèo") actualWinningChoice = "Hòa";
          else actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
        }
      }

      if (statusFilter === "unbet") {
        if (betValue !== "") return false;
      } else if (statusFilter === "bet") {
        if (betValue === "") return false;
      } else if (statusFilter === "win") {
        if (currentTab !== "past" || betValue === "" || actualWinningChoice !== betValue)
          return false;
      } else if (statusFilter === "lose") {
        if (
          currentTab !== "past" ||
          betValue === "" ||
          actualWinningChoice === betValue ||
          actualWinningChoice === "Hòa" ||
          !actualWinningChoice
        )
          return false;
      } else if (statusFilter === "wait") {
        if (currentTab !== "past" || actualWinningChoice !== "") return false;
      }
    }

    return true;
  });

  // Đảo ngược thứ tự cho tab lịch sử (trận mới nhất lên trên)
  if (currentTab === "past") {
    filteredData.reverse();
  }

  if (filteredData.length === 0) {
    tbody.innerHTML = `<div class="bg-white rounded-2xl p-10 text-center text-gray-500 border border-gray-100 shadow-sm">Không có trận đấu nào phù hợp với bộ lọc.</div>`;
    return;
  }

  filteredData.forEach((row) => {
    var homeTeam = String(row[4] || "").trim();
    var awayTeam = String(row[5] || "").trim();
    var homeScore = row[6] !== "" ? row[6] : "";
    var awayScore = row[7] !== "" ? row[7] : "";
    
    var matchStatus = String(row[8] || "").trim();
    var liveIndicator = matchStatus === "Đang đá" 
      ? `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-600 animate-pulse"><span class="w-1.5 h-1.5 bg-red-600 rounded-full mr-1.5"></span>LIVE</span>` 
      : "";
    
    var scoreDisplay =
      homeScore !== "" && awayScore !== ""
        ? ` <span class="text-[#e53e3e] font-extrabold mx-1">${homeScore} - ${awayScore}</span> `
        : " vs ";

    var betValue = String(row[16] || "").trim();
    var winningTeam = String(row[10] || "").trim();
    var upperTeam = String(row[12] || "").trim();
    var lowerTeam = upperTeam === homeTeam ? awayTeam : homeTeam;

    var actualWinningChoice = "";
    if (winningTeam && matchStatus.includes("Kết thúc")) {
      var hScoreNum = parseFloat(row[6]);
      var aScoreNum = parseFloat(row[7]);
      var hCapNum = parseFloat(row[13]);
      if (!isNaN(hScoreNum) && !isNaN(aScoreNum) && !isNaN(hCapNum)) {
        var diffNum = upperTeam === homeTeam ? hScoreNum - aScoreNum : aScoreNum - hScoreNum;
        if (diffNum === hCapNum) actualWinningChoice = "Hòa";
        else if (diffNum > hCapNum) actualWinningChoice = "Cửa trên";
        else actualWinningChoice = "Cửa dưới";
      } else {
        if (winningTeam === "Hòa" || winningTeam === "Hòa kèo") actualWinningChoice = "Hòa";
        else actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
      }
    }

    var isDisabled = currentTab === "past" ? "disabled" : "";

    // Kết quả badge (past tab)
    var resultHtml = "";
    var badgeClass = "status-wait";
    var badgeText = matchStatus === "Đang đá" ? "⏳ Đang đá" : "⏳ Chờ KQ";
    if (actualWinningChoice) {
      if (actualWinningChoice === "Hòa") {
        badgeClass = "status-draw";
        badgeText = "➖ Hòa kèo";
      } else if (betValue === "") {
        badgeClass = "status-lose";
        badgeText = "❌ Không chọn";
      } else if (actualWinningChoice === betValue) {
        badgeClass = "status-win";
        badgeText = "✅ Thắng";
      } else {
        badgeClass = "status-lose";
        badgeText = "❌ Thua";
      }
    }

    // Định dạng thời gian
    var matchTimeObj = new Date(row[3]);
    var timeStr = isNaN(matchTimeObj.getTime())
      ? row[3]
      : matchTimeObj.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }) +
        " • " +
        matchTimeObj.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        });

    var unbetClass = currentTab === "active" && betValue === "" ? "row-unbet" : "";
    var unbetIcon =
      currentTab === "active" && betValue === ""
        ? ` <span class="text-amber-500 font-bold ml-1.5 text-xs animate-pulse" title="Bạn chưa chọn kèo!"><i class="ti ti-alert-triangle"></i></span>`
        : "";

    var homeBadge = homeTeam === upperTeam ? ' <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 ml-1.5"><i class="ti ti-star-filled mr-0.5 text-amber-500"></i>KÈO TRÊN</span>' : '';
    var awayBadge = awayTeam === upperTeam ? ' <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 ml-1.5"><i class="ti ti-star-filled mr-0.5 text-amber-500"></i>KÈO TRÊN</span>' : '';

    if (currentTab === "past") {
      matchDataCache[row[0]] = row;
      
      tbody.innerHTML += `
        <div onclick="openMatchDetail(${row[0]})" class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden match-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:bg-emerald-50/10 hover:border-emerald-100 transition-all fade-in-up">
          <div class="flex flex-col md:flex-row items-center gap-6 flex-1 justify-center md:justify-start">
            <div class="flex md:flex-col items-center justify-between md:border-r border-gray-100 md:pr-6 md:w-44 text-center w-full md:w-auto">
              <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Kick-off</p>
                <p class="text-sm font-bold text-gray-700">${timeStr}</p>
              </div>
              <div class="mt-2">
                <span class="status-badge ${badgeClass} text-[11px] py-1 px-3">${badgeText}</span>
              </div>
            </div>

            <div class="flex items-center gap-8 justify-center flex-1">
              <div class="text-center md:text-left min-w-[120px]">
                <h3 class="text-base font-bold text-gray-800 flex items-center justify-center md:justify-start flex-wrap gap-1">${homeTeam}${homeBadge}</h3>
                <p class="text-[10px] font-bold text-gray-400 mt-0.5 uppercase">CHỦ NHÀ</p>
              </div>
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-3">
                  <span class="text-2xl font-black text-gray-800">${homeScore !== "" ? homeScore : ""}</span>
                  <span class="text-gray-300 font-medium text-lg">${homeScore !== "" && awayScore !== "" ? "-" : "vs"}</span>
                  <span class="text-2xl font-black text-gray-800">${awayScore !== "" ? awayScore : ""}</span>
                </div>
                <div class="mt-1.5 px-2.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-lg text-[10px] font-bold border border-yellow-100">
                  Chấp: ${row[13]}
                </div>
              </div>

              <div class="text-center md:text-right min-w-[120px]">
                <h3 class="text-base font-bold text-gray-800 flex items-center justify-center md:justify-end flex-wrap gap-1">${awayBadge}${awayTeam}</h3>
                <p class="text-[10px] font-bold text-gray-400 mt-0.5 uppercase">KHÁCH</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2 w-full md:w-auto">
            <button class="flex-1 md:w-28 py-2.5 rounded-xl border border-gray-100 text-xs text-gray-400 font-semibold bg-gray-50/50 cursor-not-allowed ${betValue === "Cửa trên" ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold" : ""}" disabled>
              ▲ ${upperTeam}
            </button>
            <button class="flex-1 md:w-28 py-2.5 rounded-xl border border-gray-100 text-xs text-gray-400 font-semibold bg-gray-50/50 cursor-not-allowed ${betValue === "Cửa dưới" ? "border-emerald-200 bg-emerald-50 text-emerald-700 font-bold" : ""}" disabled>
              ▼ ${lowerTeam}
            </button>
          </div>
        </div>
      `;
    } else {
      // Active Matches render
      tbody.innerHTML += `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden match-card p-6 flex flex-col md:flex-row items-center justify-between gap-6 fade-in-up ${unbetClass}">
          <div class="flex flex-col md:flex-row items-center gap-6 flex-1 justify-center md:justify-start">
            <div class="flex md:flex-col items-center justify-between md:border-r border-gray-100 md:pr-6 md:w-44 text-center w-full md:w-auto">
              <div>
                <p class="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Kick-off</p>
                <p class="text-sm font-bold text-gray-700">${timeStr}</p>
              </div>
              <div class="mt-2" id="cd-${row[0]}">
                ⏱...
              </div>
            </div>

            <div class="flex items-center gap-8 justify-center flex-1">
              <div class="text-center md:text-left min-w-[120px]">
                <h3 class="text-base font-bold text-gray-800 flex items-center justify-center md:justify-start flex-wrap gap-1">${homeTeam}${homeBadge}</h3>
                <p class="text-[10px] font-bold text-gray-400 mt-0.5 uppercase">CHỦ NHÀ</p>
              </div>
              
              <div class="flex flex-col items-center">
                <div class="flex items-center gap-2">
                  <span class="text-xl font-bold text-gray-800">${homeScore !== "" ? homeScore : ""}</span>
                  <span class="text-gray-300 font-medium text-sm">vs</span>
                  <span class="text-xl font-bold text-gray-800">${awayScore !== "" ? awayScore : ""}</span>
                  ${liveIndicator}
                </div>
                <div class="mt-1.5 px-2.5 py-0.5 bg-yellow-50 text-yellow-700 rounded-lg text-[10px] font-bold border border-yellow-100">
                  Chấp: ${row[13]}
                </div>
              </div>

              <div class="text-center md:text-right min-w-[120px]">
                <h3 class="text-base font-bold text-gray-800 flex items-center justify-center md:justify-end flex-wrap gap-1">${awayBadge}${awayTeam}</h3>
                <p class="text-[10px] font-bold text-gray-400 mt-0.5 uppercase">KHÁCH</p>
              </div>
            </div>
          </div>

          <div class="flex gap-2 w-full md:w-auto">
            <button id="btn-u-${row[0]}" onclick="bet(this, ${row[0]}, 'Cửa trên')" class="flex-1 md:w-32 py-2.5 rounded-xl border-2 border-gray-100 text-gray-600 font-bold text-sm bg-white hover:border-[#0F5132] hover:text-[#0F5132] transition-all btn-choice ${betValue === "Cửa trên" ? "selected" : ""}" ${isDisabled}>
              ▲ ${upperTeam}
            </button>
            <button id="btn-d-${row[0]}" onclick="bet(this, ${row[0]}, 'Cửa dưới')" class="flex-1 md:w-32 py-2.5 rounded-xl border-2 border-gray-100 text-gray-600 font-bold text-sm bg-white hover:border-[#0F5132] hover:text-[#0F5132] transition-all btn-choice ${betValue === "Cửa dưới" ? "selected" : ""}" ${isDisabled}>
              ▼ ${lowerTeam}
            </button>
          </div>
        </div>
      `;
    }
  });

  // Khởi động countdown cho tất cả trận active sau khi render xong
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

function loadLeaderboardData() {
  showLoader();
  var tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-gray-500">⏳ Đang tải bảng điểm...</td></tr>`;

  apiCall("getLeaderboard")
    .then((data) => {
      tbody.innerHTML = "";

      if (!data || data.error || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-red-500 font-semibold">Không thể tải dữ liệu hoặc bảng trống!</td></tr>`;
        hideLoader();
        return;
      }

      leaderboardCache = data; // Lưu cache để dùng cho chi tiết trận đấu

      // Tự động sort theo hạng tăng dần
      data.sort((a, b) => Number(a.rank) - Number(b.rank));

      data.forEach((player) => {
        let winRateFormatted =
          typeof player.winRate === "number"
            ? (player.winRate * 100).toFixed(1) + "%"
            : player.winRate;

        // Phân cấp hàng dựa trên thứ hạng hoặc điểm âm để đồng bộ CSS
        let highlightClass = "";
        if (player.rank == 1) highlightClass = "top-1";
        else if (player.rank == 2) highlightClass = "top-2";
        else if (Number(player.totalScore) < 0) highlightClass = "negative-score";

        let badgesHtml = "";
        if (player.badges && player.badges.length > 0) {
          badgesHtml = '<div class="badges-container mt-1.5">';
          player.badges.forEach((b) => {
            let bClass = "";
            if (b.includes("Tiên Tri")) bClass = "badge-tien-tri";
            else if (b.includes("Pele")) bClass = "badge-pele";
            else if (b.includes("Từ Thiện")) bClass = "badge-tu-thien";
            else if (b.includes("Tâm Linh")) bClass = "badge-tam-linh";
            else if (b.includes("Ngược Dòng")) bClass = "badge-nguoc-dong";
            badgesHtml += `<span class="player-badge ${bClass}">${b}</span>`;
          });
          badgesHtml += "</div>";
        }

        tbody.innerHTML += `
          <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-all ${highlightClass}">
            <td class="p-4 font-bold text-gray-700">${player.rank}</td>
            <td class="p-4">
              <div class="font-bold text-gray-800">${player.name}</div>
              ${badgesHtml}
            </td>
            <td class="p-4 text-center font-extrabold text-[#0F5132]">${player.totalScore}</td>
            <td class="p-4 text-center font-bold text-green-600">${player.winMatches}</td>
            <td class="p-4 text-center font-bold text-red-500">${player.loseMatches}</td>
            <td class="p-4 text-center font-semibold text-gray-700">${winRateFormatted}</td>
            <td class="p-4 text-center text-gray-500">${player.maxWinStreak}</td>
            <td class="p-4 text-center text-gray-500">${player.maxLoseStreak}</td>
          </tr>
        `;
      });
      hideLoader();
    })
    .catch((err) => {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8 text-red-500">Có lỗi xảy ra khi kết nối đồng bộ!</td></tr>`;
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
  x.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[300px] bg-slate-900 text-white text-center rounded-xl p-4 shadow-2xl text-sm font-medium visible opacity-1 show";

  setTimeout(() => {
    x.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 min-w-[300px] bg-slate-900 text-white text-center rounded-xl p-4 shadow-2xl text-sm font-medium invisible opacity-0 transition-all duration-300";
  }, 3000);
}

function showWarningModal() {
  const modal = document.getElementById("warningModal");
  if (modal) {
    modal.classList.add("show");
  }
}

function closeWarningModal() {
  const modal = document.getElementById("warningModal");
  if (modal) {
    modal.classList.remove("show");
  }
}

function logout() {
  localStorage.removeItem("currentUserEmail");
  localStorage.removeItem("currentUserName");
  window.location.reload();
}

function clearAllCountdowns() {
  Object.keys(countdownIntervals).forEach(function (stt) {
    clearInterval(countdownIntervals[stt]);
  });
  countdownIntervals = {};
}

function parseMatchTime(timeStr) {
  if (!timeStr) return null;
  var s = String(timeStr);

  var m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (m) {
    return new Date(
      parseInt(m[3]),
      parseInt(m[2]) - 1,
      parseInt(m[1]),
      parseInt(m[4]),
      parseInt(m[5]),
    );
  }

  var d = new Date(timeStr);
  return isNaN(d.getTime()) ? null : d;
}

function startCountdown(stt, matchTimeStr, buttons, tdEl) {
  var matchTime = parseMatchTime(matchTimeStr);
  if (!matchTime) {
    tdEl.innerHTML = '<span class="cd-unknown">--</span>';
    return;
  }

  var lockTime = new Date(matchTime.getTime() - 1 * 60 * 1000);

  function tick() {
    var now = new Date();
    var diff = lockTime - now;

    if (diff <= 0) {
      tdEl.innerHTML = '<span class="cd-locked">🔒 Đã khóa</span>';
      buttons.forEach(function (btn) {
        btn.disabled = true;
      });
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
      display = days + "ngày " + (h % 24) + "h";
      cls = "cd-safe";
    } else if (h > 0) {
      display = h + "h " + String(mi).padStart(2, "0") + "m";
      cls = h >= 3 ? "cd-safe" : "cd-warning";
    } else {
      display = String(mi).padStart(2, "0") + "m " + String(s).padStart(2, "0") + "s";
      cls = "cd-urgent";
    }

    tdEl.innerHTML = '<span class="' + cls + '">⏱ ' + display + "</span>";
  }

  tick(); // Chạy ngay lần đầu
  countdownIntervals[stt] = setInterval(tick, 1000);
}

function manualRefresh() {
  var btn = document.getElementById("btnRefresh");
  if (!btn || btn.disabled) return;

  btn.disabled = true;
  const icon = btn.querySelector('i');
  if (icon) icon.classList.add("animate-spin");

  if (currentTab === "leaderboard") {
    loadLeaderboardData();
  } else {
    loadData(true);
  }

  setTimeout(function () {
    btn.disabled = false;
    if (icon) icon.classList.remove("animate-spin");
  }, 2000);
}

function loadMyStats() {
  var currentName = localStorage.getItem("currentUserName");
  if (!currentName) return;

  apiCall("getLeaderboard")
    .then(function (data) {
      if (!data || data.error || !Array.isArray(data)) return;

      var me = data.find(function (p) {
        return String(p.name).trim() === String(currentName).trim();
      });

      if (!me) return;

      var winRate =
        typeof me.winRate === "number"
          ? (me.winRate * 100).toFixed(0) + "%"
          : String(me.winRate || "--");

      document.getElementById("statRank").textContent = "#" + me.rank;
      document.getElementById("statWin").textContent = me.winMatches;
      document.getElementById("statLose").textContent = me.loseMatches;
      document.getElementById("statRate").textContent = winRate;

      var scoreEl = document.getElementById("statScore");
      var score = Number(me.totalScore);
      scoreEl.textContent = (score >= 0 ? "+" : "") + score;
      scoreEl.style.color = score >= 0 ? "#0f5132" : "#e53e3e";

      document.getElementById("myStatsCard").style.display = "block";
    })
    .catch(console.error);
}

function openMatchDetail(stt) {
  var row = matchDataCache[stt];
  if (!row) return;

  var homeTeam = String(row[4] || "").trim();
  var awayTeam = String(row[5] || "").trim();
  var homeScore = row[6] !== "" ? row[6] : "";
  var awayScore = row[7] !== "" ? row[7] : "";
  var upperTeam = String(row[12] || "").trim();
  var lowerTeam = upperTeam === homeTeam ? awayTeam : homeTeam;
  var handicap = row[13];
  var betValue = String(row[16] || "").trim();
  var winningTeam = String(row[10] || "").trim();

  var matchStatusDetail = String(row[8] || "").trim();
  var actualWinningChoice = "";
  if (winningTeam && matchStatusDetail.includes("Kết thúc")) {
    var hScoreNum = parseFloat(row[6]);
    var aScoreNum = parseFloat(row[7]);
    var hCapNum = parseFloat(row[13]);
    if (!isNaN(hScoreNum) && !isNaN(aScoreNum) && !isNaN(hCapNum)) {
      var diffNum = upperTeam === homeTeam ? hScoreNum - aScoreNum : aScoreNum - hScoreNum;
      if (diffNum === hCapNum) actualWinningChoice = "Hòa";
      else if (diffNum > hCapNum) actualWinningChoice = "Cửa trên";
      else actualWinningChoice = "Cửa dưới";
    } else {
      if (winningTeam === "Hòa" || winningTeam === "Hòa kèo") actualWinningChoice = "Hòa";
      else actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
    }
  }

  var scoreStr =
    homeScore !== "" && awayScore !== ""
      ? `<span class="text-[#e53e3e] font-extrabold">${homeScore} – ${awayScore}</span>`
      : `<span class="text-gray-300">vs</span>`;
  document.getElementById("detailMatchTitle").innerHTML =
    `${homeTeam} &nbsp;${scoreStr}&nbsp; ${awayTeam}`;

  var myResultBadge;
  if (!actualWinningChoice) {
    myResultBadge = '<span class="status-badge status-wait">⏳ Chờ KQ</span>';
  } else if (actualWinningChoice === "Hòa") {
    myResultBadge = '<span class="status-badge status-draw">➖ Hòa kèo</span>';
  } else if (!betValue) {
    myResultBadge = '<span class="status-badge status-lose">❌ Không chọn</span>';
  } else if (betValue === actualWinningChoice) {
    myResultBadge = '<span class="status-badge status-win">✅ Thắng</span>';
  } else {
    myResultBadge = '<span class="status-badge status-lose">❌ Thua</span>';
  }

  var myChoiceLabel =
    betValue === "Cửa trên"
      ? "▲ " + upperTeam
      : betValue === "Cửa dưới"
        ? "▼ " + lowerTeam
        : "Chưa chọn";

  var resultLabel =
    actualWinningChoice === "Hòa"
      ? "➖ Hòa kèo"
      : actualWinningChoice === "Cửa trên"
        ? "▲ " + upperTeam
        : actualWinningChoice === "Cửa dưới"
          ? "▼ " + lowerTeam
          : "Chưa có";

  document.getElementById("detailMatchInfo").innerHTML = `
    <div class="grid grid-cols-2 gap-3 text-sm">
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Cửa trên</span>
        <span class="font-bold text-gray-800">▲ ${upperTeam}</span>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Tỷ lệ chấp</span>
        <span class="font-bold text-[#e53e3e]">${handicap}</span>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Bạn chọn</span>
        <span class="font-bold text-gray-800">${myChoiceLabel}</span>
      </div>
      <div class="bg-gray-50 p-3 rounded-xl border border-gray-100">
        <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Kết quả kèo</span>
        <span class="font-bold text-gray-800">${resultLabel}</span>
      </div>
    </div>
    <div class="flex justify-center mt-4">${myResultBadge}</div>
  `;

  resetMemeEffects(); // Reset trước khi show dữ liệu mới
  document.getElementById("detailVotesList").innerHTML =
    '<div class="text-center p-8 text-gray-500">⏳ Đang tải bình chọn...</div>';

  var modal = document.getElementById("matchDetailModal");
  modal.classList.add("show");

  if (betValue && actualWinningChoice) {
    if (betValue === actualWinningChoice) {
      triggerWinEffect();
    } else {
      triggerLoseEffect();
    }
  }

  apiCall("getMatchDetail", { stt: stt })
    .then(function (votes) {
      if (!votes || votes.error) {
        document.getElementById("detailVotesList").innerHTML =
          '<p class="text-red-500 text-center p-4">Không thể tải dữ liệu bình chọn.</p>';
        return;
      }

      var upperCount = votes.filter(function (v) {
        return v.choice === "Cửa trên";
      }).length;
      var lowerCount = votes.filter(function (v) {
        return v.choice === "Cửa dưới";
      }).length;
      var total = votes.length;
      var upperPct = total > 0 ? Math.round((upperCount / total) * 100) : 0;
      var lowerPct = total > 0 ? Math.round((lowerCount / total) * 100) : 0;

      var summaryHtml = `
        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-gray-600">
            <span>▲ ${upperTeam}</span>
            <span>${upperCount} người (${upperPct}%)</span>
          </div>
          <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div class="bg-emerald-600 h-full rounded-full transition-all duration-700" style="width: ${upperPct}%"></div>
          </div>
          <div class="flex items-center justify-between text-xs font-bold text-gray-600 pt-1">
            <span>▼ ${lowerTeam}</span>
            <span>${lowerCount} người (${lowerPct}%)</span>
          </div>
          <div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div class="bg-blue-600 h-full rounded-full transition-all duration-700" style="width: ${lowerPct}%"></div>
          </div>
        </div>
      `;

      var votesHtml = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">';
      votes.forEach(function (v) {
        var isCorrect = actualWinningChoice && actualWinningChoice !== "Hòa" && v.choice === actualWinningChoice;
        var isWrong = actualWinningChoice && actualWinningChoice !== "Hòa" && v.choice && v.choice !== actualWinningChoice;
        var isDraw = actualWinningChoice === "Hòa";
        var choiceLabel =
          v.choice === "Cửa trên"
            ? "▲ " + upperTeam
            : v.choice === "Cửa dưới"
              ? "▼ " + lowerTeam
              : "—";
        var choiceClass =
          v.choice === "Cửa trên"
            ? "text-emerald-700 bg-emerald-50 border border-emerald-100"
            : v.choice === "Cửa dưới"
              ? "text-blue-700 bg-blue-50 border border-blue-100"
              : "text-gray-400 bg-gray-50 border border-gray-100";
        var cardClass = isCorrect 
          ? "border-green-200 bg-green-50/50" 
          : isWrong 
            ? "border-red-200 bg-red-50/50" 
            : isDraw
              ? "border-yellow-200 bg-yellow-50/50"
              : "border-gray-100 bg-white";

        var userBadgeHtml = "";
        var cachedUser = leaderboardCache.find((p) => p.name === v.name);
        if (cachedUser && cachedUser.badges && cachedUser.badges.length > 0) {
          userBadgeHtml = '<div class="flex flex-wrap gap-1 mt-1 justify-center">';
          cachedUser.badges.forEach((b) => {
            let bClass = "";
            if (b.includes("Tiên Tri")) bClass = "badge-tien-tri";
            else if (b.includes("Pele")) bClass = "badge-pele";
            else if (b.includes("Từ Thiện")) bClass = "badge-tu-thien";
            else if (b.includes("Tâm Linh")) bClass = "badge-tam-linh";
            else if (b.includes("Ngược Dòng")) bClass = "badge-nguoc-dong";
            userBadgeHtml += `<span class="player-badge ${bClass} text-[9px] px-1 py-0.5" title="${b}">${b.split(" ")[0]}</span>`;
          });
          userBadgeHtml += "</div>";
        }

        votesHtml += `
          <div class="border rounded-xl p-3 text-center transition-all hover:shadow-sm ${cardClass}">
            <div class="font-bold text-xs text-gray-800 truncate" title="${v.name}">${v.name}</div>
            ${userBadgeHtml}
            <div class="text-[11px] font-bold py-1 px-2 rounded-lg mt-2 inline-block ${choiceClass}">${choiceLabel}</div>
          </div>
        `;
      });
      votesHtml += "</div>";

      document.getElementById("detailVotesList").innerHTML = summaryHtml + votesHtml;
    })
    .catch(function (err) {
      console.error(err);
      document.getElementById("detailVotesList").innerHTML =
        '<p class="text-red-500 text-center p-4">Có lỗi xảy ra khi tải dữ liệu.</p>';
    });
}

function closeMatchDetail() {
  var modal = document.getElementById("matchDetailModal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(function () {
      resetMemeEffects(); // Reset effects when closing
    }, 300);
  }
}

// Đóng modal khi click ra ngoài vùng nội dung
document.addEventListener("click", function(event) {
  var modal = document.getElementById("matchDetailModal");
  if (modal && modal.classList.contains("show")) {
    if (event.target === modal || event.target.id === "rainContainer") {
      closeMatchDetail();
    }
  }
});

document.addEventListener("keydown", function(event) {
  if (event.key === "Escape") {
    var modal = document.getElementById("matchDetailModal");
    if (modal && modal.classList.contains("show")) {
      closeMatchDetail();
    }
  }
});

var currentAudio = null;

function triggerWinEffect() {
  if (typeof confetti === "function") {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#0F5132", "#4ade80", "#fbbf24"],
    });
  }
  playMemeSound("win");
}

function triggerLoseEffect() {
  var modal = document.getElementById("matchDetailModal");
  modal.classList.add("is-lose");

  var rainContainer = document.getElementById("rainContainer");
  rainContainer.style.display = "block";
  rainContainer.innerHTML = "";

  for (var i = 0; i < 20; i++) {
    var drop = document.createElement("div");
    drop.className = "raindrop";
    drop.style.left = Math.random() * 100 + "%";
    drop.style.animationDuration = Math.random() * 0.5 + 0.5 + "s";
    drop.style.animationDelay = Math.random() * 2 + "s";
    rainContainer.appendChild(drop);
  }

  playMemeSound("lose");
}

function resetMemeEffects() {
  var modal = document.getElementById("matchDetailModal");
  if (modal) modal.classList.remove("is-lose");

  var rainContainer = document.getElementById("rainContainer");
  if (rainContainer) {
    rainContainer.style.display = "none";
    rainContainer.innerHTML = "";
  }

  var soundToggle = document.getElementById("soundToggle");
  if (soundToggle) {
    soundToggle.style.display = "none";
  }

  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}

function playMemeSound(type) {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  var src =
    type === "win"
      ? "https://www.myinstants.com/media/sounds/crowd-cheering.mp3"
      : "https://www.myinstants.com/media/sounds/sad-violin.mp3";

  currentAudio = new Audio(src);
  currentAudio.play().catch(function (e) {
    console.log("Audio play prevented:", e);
  });
}

let liveScoreInterval;

function startLiveScoreAutoRefresh() {
  if (liveScoreInterval) clearInterval(liveScoreInterval);
  
  liveScoreInterval = setInterval(() => {
    if (currentTab === "active") {
      loadData(false); // pass false to avoid showing the loader
    }
  }, 60000);
}
