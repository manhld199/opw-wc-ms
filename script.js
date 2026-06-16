const GAS_URL =
  "https://script.google.com/macros/s/AKfycbym9V4LdU7HxPPHL9CzxheBkqrauwKqQLnmxpwqjMeT0WBJaZvcmAUpPyQonNqA8wfT/exec";

let currentUserEmail = "";
let currentTab = "active"; // Các trạng thái: "active", "past", hoặc "leaderboard"

function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  currentUserEmail = payload.email;

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("userInfo").style.display = "flex";
  document.getElementById("tabContainer").style.display = "flex";

  // Mặc định ban đầu hiển thị bảng trận đấu
  document.getElementById("mainTable").style.display = "table";
  document.getElementById("leaderboardTable").style.display = "none";

  loadData();
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

function loadData() {
  // Lấy thông tin user
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

// THÊM MỚI HÀM ĐỔ DỮ LIỆU BẢNG VÀNG
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
    })
    .catch((err) => {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#e53e3e;">Có lỗi xảy ra khi kết nối đồng bộ!</td></tr>`;
    });
}

function bet(btn, stt, choice) {
  // Chặn trường hợp kích hoạt cược nhầm khi không ở tab active
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
