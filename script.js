const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzkRTXvqViEmnJH92iSzRCI1cu1QfjKaKXj8NJsmUopiwN2ufu7wvB0FI5SdNVzYfeP/exec";

let currentUserEmail = "";
let currentTab = "active"; // "active" hoặc "past"

function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  currentUserEmail = payload.email;

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("userInfo").style.display = "flex";
  document.getElementById("tabContainer").style.display = "flex";
  document.getElementById("mainTable").style.display = "table";

  loadData();
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

function switchTab(tabName) {
  if (currentTab === tabName) return;
  currentTab = tabName;

  // Cập nhật trạng thái active UI của nút tab
  document.getElementById("btnActiveMatches").classList.toggle("active", tabName === "active");
  document.getElementById("btnPastMatches").classList.toggle("active", tabName === "past");

  // Tải lại dữ liệu tương ứng với tab mới
  loadData();
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

function bet(btn, stt, choice) {
  // Chặn trường hợp cố tình kích hoạt khi đang ở tab xem lại
  if (currentTab === "past") return;

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
