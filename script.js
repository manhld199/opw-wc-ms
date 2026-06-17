const GAS_URL =
  "https://script.google.com/macros/s/AKfycbym9V4LdU7HxPPHL9CzxheBkqrauwKqQLnmxpwqjMeT0WBJaZvcmAUpPyQonNqA8wfT/exec";

let currentUserEmail = "";
let currentTab = "active"; // Các trạng thái: "active", "past", hoặc "leaderboard"

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
    document.getElementById("leaderboardTable").style.display = "none";

    loadData();
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
  document.getElementById("leaderboardTable").style.display = "none";

  loadData();
  showWarningModal();
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
    document.getElementById("leaderboardTable").style.display = "table";
    loadLeaderboardData();
  } else {
    document.getElementById("mainTable").style.display = "table";
    document.getElementById("leaderboardTable").style.display = "none";
    loadData();
  }
}

function loadData(showLoading = true) {
  if (showLoading) showLoader(); // Bật loader khi tải dữ liệu

  // Lấy thông tin user
  apiCall("getUserInfo")
    .then((user) => {
      // Sync names to localstorage in case it changed
      localStorage.setItem("currentUserName", user.name || "");
      document.getElementById("userInfo").innerHTML = `
        <span>⚽ <b>Người chơi:</b> ${user.name}</span> 
        <span style="color: #a0aec0">|</span> 
        <span>📧 <b>Email:</b> ${user.email}</span>
        <button class="logout-btn" onclick="logout()">Đăng xuất</button>
      `;
    })
    .catch(console.error);

  // Xác định action API cần gọi dựa vào Tab hiện tại
  const targetAction = currentTab === "active" ? "getMatches" : "getPastMatches";

  apiCall(targetAction)
    .then((data) => {
      var tbody = document.getElementById("matchBody");
      tbody.innerHTML = "";

      // Quản lý hiển thị cột Kết quả trên thead
      if (currentTab === "past") {
        document.getElementById("thResult").style.display = "table-cell";
      } else {
        document.getElementById("thResult").style.display = "none";
      }

      if (data.length === 0) {
        let colspan = currentTab === "past" ? "8" : "7";
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align:center; padding: 30px; color: #718096;">Không có trận đấu nào trong danh mục này.</td></tr>`;
        hideLoader();
        return;
      }

      data.forEach((row) => {
        // Sheet columns (0-indexed): [0]=STT, [1]=?, [2]=?, [3]=Thời gian, [4]=Chủ nhà, [5]=Đội khách
        // [6]=Bàn thắng chủ nhà, [7]=Bàn thắng đội khách, [8]=Trạng thái
        // [10]=Đội thắng kèo (Cột K), [12]=Cửa trên (Cột M), [13]=Lý do chấp
        // [16]=lựa chọn của user (pushed by API)
        var homeTeam = String(row[4] || "").trim();  // Cột E: Đội chủ nhà
        var awayTeam = String(row[5] || "").trim();  // Cột F: Đội khách
        var homeScore = row[6] !== "" ? row[6] : ""; // Cột G: Bàn thắng chủ nhà
        var awayScore = row[7] !== "" ? row[7] : ""; // Cột H: Bàn thắng đội khách
        var scoreDisplay = (homeScore !== "" && awayScore !== "") ? ` <span style="color:#e53e3e; font-weight:bold;">${homeScore} - ${awayScore}</span> ` : " vs ";
        var matchTitle = `${homeTeam}${scoreDisplay}${awayTeam}`;

        var betValue = String(row[16] || "").trim();   // Lựa chọn của user (pushed bởi API)
        var winningTeam = String(row[10] || "").trim(); // Cột K: Tên đội thắng kèo
        var upperTeam = String(row[12] || "").trim();   // Cột M: Đội cửa trên
        var lowerTeam = upperTeam === homeTeam ? awayTeam : homeTeam; // Đội cửa dưới

        // Quy đổi tên đội thắng thành Cửa trên / Cửa dưới
        var actualWinningChoice = "";
        if (winningTeam) {
          if (winningTeam === upperTeam) {
            actualWinningChoice = "Cửa trên";
          } else {
            actualWinningChoice = "Cửa dưới";
          }
        }

        // Nếu ở tab quá khứ, thêm thuộc tính disabled để khóa không cho click sửa đổi
        var isDisabled = currentTab === "past" ? "disabled" : "";

        var resultHtml = "";
        if (currentTab === "past") {
          var badgeClass = "status-wait";
          var badgeText = "⏳ Chờ KQ";

          if (actualWinningChoice) {
            if (betValue === "") {
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
          resultHtml = `<td data-label="Kết quả"><span class="status-badge ${badgeClass}">${badgeText}</span></td>`;
        }

        tbody.innerHTML += `
          <tr>
            <td data-label="STT">${row[0]}</td>
            <td data-label="Thời gian">${row[3]}</td>
            <td data-label="Trận đấu">${matchTitle}</td>
            <td data-label="Cửa trên">${upperTeam}</td>
            <td data-label="Chấp">${row[13]}</td>

            <td data-label="Chọn Cửa trên">
              <button
                class="btn ${betValue === "Cửa trên" ? "selected" : ""}"
                ${isDisabled}
                onclick="bet(this, ${row[0]}, 'Cửa trên')">
                ▲ ${upperTeam}
              </button>
            </td>

            <td data-label="Chọn Cửa dưới">
              <button
                class="btn ${betValue === "Cửa dưới" ? "selected" : ""}"
                ${isDisabled}
                onclick="bet(this, ${row[0]}, 'Cửa dưới')">
                ▼ ${lowerTeam}
              </button>
            </td>
            ${resultHtml}
          </tr>
        `;
      });
      hideLoader(); // Tắt loader khi render xong
    })
    .catch((err) => {
      console.error(err);
      hideLoader(); // Tắt loader khi có lỗi
    });
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
