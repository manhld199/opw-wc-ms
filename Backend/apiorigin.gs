function doGet(e) {
  return ContentService
    .createTextOutput("OK")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var params = e.parameter;

    var action = params.action;
    var email = params.email;

    var output;

    if (action === "getUserInfo") {
      output = getUserInfo(email);
    }
    else if (action === "getMatches") {
      output = getMatches(email);
    }
    else if (action === "getPastMatches") {
      output = getPastMatches(email);
    }
    else if (action === "getLeaderboard") {
      output = getLeaderboard();
    }
    else if (action === "submitBet") {
      output = submitBet(
        email,
        params.stt,
        params.choice
      );
    }
    else {
      output = {
        error: "Invalid Action"
      };
    }

    return ContentService
      .createTextOutput(JSON.stringify(output))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(
        JSON.stringify({
          error: err.toString()
        })
      )
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getUserInfo(email) {
  var data = SpreadsheetApp
    .getActiveSpreadsheet()
    .getSheetByName("Data")
    .getRange("A2:C50")
    .getValues();

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == email) {
      return {
        name: data[i][1],
        email: email
      };
    }
  }

  return {
    name: "Khách",
    email: email
  };
}

function getMatches(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");

  var userData = sheetData
    .getRange("A2:C50")
    .getValues();

  var userColChar = "";

  for (var i = 0; i < userData.length; i++) {
    if (userData[i][0] == email) {
      userColChar = userData[i][2];
      break;
    }
  }

  if (userColChar === "") {
    return [];
  }

  var userColNum = columnLetterToNumber(userColChar);

  var infoRange = sheetInfo
    .getRange(3, 1, 100, 16)
    .getValues();

  var userBets = sheetBet
    .getRange(3, userColNum, 100, 1)
    .getValues();

  var results = [];

  for (var j = 0; j < infoRange.length; j++) {
    if (
      infoRange[j][0] !== "" &&
      infoRange[j][8] === "Chưa đá"
    ) {
      var row = infoRange[j];
      row.push(String(userBets[j][0] || "").trim());
      results.push(row);
    }
  }

  return results;
}

function submitBet(email, stt, choice) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");

  var userData = sheetData
    .getRange("A2:C50")
    .getValues();

  var userName = "Người chơi";
  var userColChar = "";

  for (var i = 0; i < userData.length; i++) {
    if (userData[i][0] == email) {
      userName = userData[i][1];
      userColChar = userData[i][2];
      break;
    }
  }

  if (userColChar === "") {
    return "Lỗi: Tài khoản chưa cấu hình cột!";
  }

  var userColNum = columnLetterToNumber(userColChar);

  var dataInfo = sheetInfo
    .getRange("A3:P100")
    .getValues();

  var row = -1;
  var matchData = null;

  for (var j = 0; j < dataInfo.length; j++) {
    if (dataInfo[j][0] == stt) {
      row = j + 3;
      matchData = dataInfo[j];
      break;
    }
  }

  if (row == -1) {
    return "Lỗi: Không tìm thấy trận đấu!";
  }

  var timeRaw = matchData[3];
  var matchTime;
  if (timeRaw instanceof Date) {
    matchTime = timeRaw;
  } else {
    var timeStr = String(timeRaw).trim();
    var m = timeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
    if (m) {
      matchTime = new Date(
        parseInt(m[3], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[1], 10),
        parseInt(m[4], 10),
        parseInt(m[5], 10)
      );
    } else {
      matchTime = new Date(timeStr);
    }
  }

  if (
    new Date() >
    new Date(matchTime.getTime() - 60 * 60 * 1000)
  ) {
    return "❌ Đã quá thời gian!";
  }

  sheetBet
    .getRange(row, userColNum)
    .setValue(choice);

  // try {
  //   MailApp.sendEmail(
  //     email,
  //     "Thông báo bình chọn: " +
  //       matchData[4] +
  //       " vs " +
  //       matchData[5],

  //     "Xác nhận: " +
  //       userName +
  //       ", bạn đã chọn " +
  //       choice +
  //       " cho trận " +
  //       matchData[4] +
  //       " vs " +
  //       matchData[5]
  //   );
  // } catch (e) {}

  return "✅ Đã xác nhận: " + choice;
}

// --- HÀM LẤY CÁC TRẬN QUÁ KHỨ MỚI THÊM VÀO ---
function getPastMatches(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");

  var userData = sheetData
    .getRange("A2:C50")
    .getValues();

  var userColChar = "";

  for (var i = 0; i < userData.length; i++) {
    if (userData[i][0] == email) {
      userColChar = userData[i][2];
      break;
    }
  }

  if (userColChar === "") {
    return [];
  }

  var userColNum = columnLetterToNumber(userColChar);

  var infoRange = sheetInfo
    .getRange(3, 1, 100, 16)
    .getValues();

  var userBets = sheetBet
    .getRange(3, userColNum, 100, 1)
    .getValues();

  var results = [];

  for (var j = 0; j < infoRange.length; j++) {
    // Điều kiện: Lấy những trận đã có số STT và Trạng thái KHÁC "Chưa đá"
    if (
      infoRange[j][0] !== "" &&
      infoRange[j][8] !== "Chưa đá"
    ) {
      var row = infoRange[j];
      row.push(String(userBets[j][0] || "").trim());
      results.push(row);
    }
  }

  return results;
}

// --- HÀM LẤY DỮ LIỆU BẢNG VÀNG ---
function getLeaderboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  // Thay đổi đúng tên Sheet của bạn nếu nó khác chữ "Bảng vàng"
  var sheet = ss.getSheetByName("Bảng vàng"); 
  
  if (!sheet) return { error: "Không tìm thấy sheet Bảng vàng" };

  // Lấy dữ liệu từ hàng 3 đến hàng 50 (Bỏ qua 2 hàng tiêu đề gộp dòng)
  // Cột A (Tình Nguyện Viên) đến Cột L (Chuỗi dài nhất chọn sai) -> 12 cột
  var dataRange = sheet.getRange("A3:L50").getValues();
  var leaderboard = [];

  for (var i = 0; i < dataRange.length; i++) {
    // Nếu tên Tình nguyện viên trống thì dừng/bỏ qua dòng đó
    if (dataRange[i][0] === "") continue; 

    leaderboard.push({
      name: dataRange[i][0],
      rank: dataRange[i][1],
      totalScore: dataRange[i][2],
      winMatches: dataRange[i][3],
      loseMatches: dataRange[i][4],
      winRate: dataRange[i][5],
      loseRate: dataRange[i][6],
      currentWinStreak: dataRange[i][7],
      currentLoseStreak: dataRange[i][8],
      maxWinStreak: dataRange[i][9],
      maxLoseStreak: dataRange[i][10]
    });
  }

  return leaderboard;
}

function columnLetterToNumber(col) {
  var out = 0;

  for (var i = 0; i < col.length; i++) {
    out =
      out * 26 +
      (col.charCodeAt(i) - 64);
  }

  return out;
}