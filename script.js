const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzkRTXvqViEmnJH92iSzRCI1cu1QfjKaKXj8NJsmUopiwN2ufu7wvB0FI5SdNVzYfeP/exec";

let currentUserEmail = "";
let currentTab = "active"; // Các trạng thái: "active", "past", hoặc "leaderboard"

function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  currentUserEmail = payload.email;

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("userInfo").style.display = "flex";
  document.getElementById("tabContainer").style.display = "flex";

  // Mặc định ban đầu sẽ hiển thị bảng trận đấu cược
  document.getElementById("mainTable").style.display = "table";
  document.getElementById("leaderboardTable").style.display = "none";

  loadData();
}

// Sửa lại hàm apiCall dạng JSON String + xử lý redirect 302 của Google Apps Script
async function apiCall(action, params = {}) {
  const payload = {
    action: action,
    email: currentUserEmail,
    ...params,
  };

  const response = await fetch(GAS_URL, {
    method: "POST",
    body: JSON.stringify(payload),
    redirect: "follow",
  });

  return await response.json();
}

function switchTab(tabName) {
  if (currentTab === tabName) return;
  currentTab = tabName;

  // Cập nhật trạng thái active UI của hệ thống nút tab điều hướng
  document.getElementById("btnActiveMatches").classList.toggle("active", tabName === "active");
  document.getElementById("btnPastMatches").classList.toggle("active", tabName === "past");
  document.getElementById("btnLeaderboard").classList.toggle("active", tabName === "leaderboard");

  // Xử lý ẩn hiện bảng phù hợp với tab được click chọn
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

// Hàm tải dữ liệu trận đấu (Trận sắp đá & Lịch sử cược cũ)
function loadData() {
  // Lấy thông tin user hiển thị ở banner đầu trang
  apiCall("getUserInfo")
    .then((user) => {
      document.getElementById("userInfo").innerHTML = `
        <span>⚽ <b>Người chơi:</b> ${user.name}</span> 
        <span style="color: #a0aec0">|</span> 
        <span>📧 <b>Email:</b> ${user.email}</span>
      `;
    })
    .catch(console.error);

  // Xác định action API cần gọi dựa vào Tab hiện tại
  const targetAction = currentTab === "active" ? "getMatches" : "getPastMatches";

  apiCall(targetAction)
    .then((data) => {
      var tbody = document.getElementById("matchBody");
      tbody.innerHTML = "";

      if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 30px; color: #718096;">Không có trận đấu nào trong danh mục này.</td></tr>`;
        return;
      }

      data.forEach((row) => {
        var betValue = String(row[16] || "").trim();
        // Nếu ở tab quá khứ, thêm thuộc tính disabled để khóa không cho click sửa đổi
        var isDisabled = currentTab === "past" ? "disabled" : "";

        tbody.innerHTML += `
          <tr>
            <td data-label="STT">${row[0]}</td>
            <td data-label="Thời gian">${row[3]}</td>
            <td data-label="Trận đấu">${row[4]} vs ${row[5]}</td>
            <td data-label="Cửa trên">${row[12]}</td>
            <td data-label="Chấp">${row[13]}</td>

            <td data-label="Chọn Cửa trên">
              <button
                class="btn ${betValue === "Cửa trên" ? "selected" : ""}"
                ${isDisabled}
                onclick="bet(this, ${row[0]}, 'Cửa trên')">
                Cửa trên
              </button>
            </td>

            <td data-label="Chọn Cửa dưới">
              <button
                class="btn ${betValue === "Cửa dưới" ? "selected" : ""}"
                ${isDisabled}
                onclick="bet(this, ${row[0]}, 'Cửa dưới')">
                Cửa dưới
              </button>
            </td>
          </tr>
        `;
      });
    })
    .catch(console.error);
}

// Hàm tải dữ liệu bảng điểm xếp hạng tình nguyện viên
function loadLeaderboardData() {
  var tbody = document.getElementById("leaderboardBody");
  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px;">⏳ Đang tải bảng điểm...</td></tr>`;

  apiCall("getLeaderboard")
    .then((data) => {
      tbody.innerHTML = "";

      if (!data || data.error || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#e53e3e;">Không thể tải dữ liệu hoặc bảng trống!</td></tr>`;
        return;
      }

      data.forEach((player) => {
        // Định dạng hiển thị % từ số thập phân trong Sheets (ví dụ 0.75 -> 75.0%)
        let winRateFormatted =
          typeof player.winRate === "number"
            ? (player.winRate * 100).toFixed(1) + "%"
            : player.winRate;

        // Đổ màu phân hạng đặc biệt theo class CSS dựa trên dữ liệu hàng
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
    })
    .catch((err) => {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#e53e3e;">Có lỗi xảy ra khi kết nối đồng bộ!</td></tr>`;
    });
}

function bet(btn, stt, choice) {
  // Chặn trường hợp cố tình kích hoạt khi đang ở tab xem lại lịch sử
  if (currentTab === "past" || currentTab === "leaderboard") return;

  btn.innerText = "⏳...";

  apiCall("submitBet", {
    stt: stt,
    choice: choice,
  })
    .then((res) => {
      showToast(typeof res === "string" ? res : JSON.stringify(res));
      loadData();
    })
    .catch((err) => {
      console.error(err);
      showToast("Có lỗi xảy ra");
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
