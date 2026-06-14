const GAS_URL =
  "https://script.google.com/macros/s/AKfycbzkRTXvqViEmnJH92iSzRCI1cu1QfjKaKXj8NJsmUopiwN2ufu7wvB0FI5SdNVzYfeP/exec";

let currentUserEmail = "";

function handleCredentialResponse(response) {
  const payload = JSON.parse(atob(response.credential.split(".")[1]));
  currentUserEmail = payload.email;

  document.getElementById("loginSection").style.display = "none";
  document.getElementById("userInfo").style.display = "block";
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

function loadData() {
  apiCall("getUserInfo")
    .then((user) => {
      document.getElementById("userInfo").innerHTML =
        `<b>Người chơi:</b> ${user.name} | <b>Email:</b> ${user.email}`;
    })
    .catch(console.error);

  apiCall("getMatches")
    .then((data) => {
      var tbody = document.getElementById("matchBody");
      tbody.innerHTML = "";

      data.forEach((row) => {
        var betValue = String(row[16] || "").trim();

        tbody.innerHTML += `
          <tr>
            <td>${row[0]}</td>
            <td>${row[3]}</td>
            <td>${row[4]} vs ${row[5]}</td>
            <td>${row[12]}</td>
            <td>${row[13]}</td>
            <td>${row[14]}</td>
            <td>${row[15]}</td>

            <td>
              <button
                class="btn ${betValue === "Cửa trên" ? "selected" : ""}"
                onclick="bet(this, ${row[0]}, 'Cửa trên')">
                Cửa trên
              </button>
            </td>

            <td>
              <button
                class="btn ${betValue === "Cửa dưới" ? "selected" : ""}"
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
