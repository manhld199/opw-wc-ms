function doGet(e) {
  return ContentService.createTextOutput("OK").setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var params = e.parameter;

    var action = params.action;
    var email = params.email;

    var output;

    if (action === "getUserInfo") {
      output = getUserInfo(email);
    } else if (action === "getMatches") {
      output = getMatches(email);
    } else if (action === "getPastMatches") {
      output = getPastMatches(email);
    } else if (action === "getLeaderboard") {
      output = getLeaderboard();
    } else if (action === "getMatchDetail") {
      output = getMatchDetail(params.stt);
    } else if (action === "submitBet") {
      output = submitBet(email, params.stt, params.choice, params.prediction, params.taixiu);
    } else if (action === "submitScorePrediction") {
      output = submitScorePrediction(email, params.stt, params.prediction);
    } else if (action === "submitTaiXiu") {
      output = submitTaiXiu(email, params.stt, params.taixiu);
    } else if (action === "getChartData") {
      output = getChartData();
    } else {
      output = {
        error: "Invalid Action",
      };
    }

    return ContentService.createTextOutput(JSON.stringify(output)).setMimeType(
      ContentService.MimeType.JSON,
    );
  } catch (err) {
    return ContentService.createTextOutput(
      JSON.stringify({
        error: err.toString(),
      }),
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

function getUserInfo(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetData = ss.getSheetByName("Data");
  var data = sheetData.getRange("A2:C50").getValues();

  var name = "Khách";
  var colChar = "";

  for (var i = 0; i < data.length; i++) {
    if (data[i][0] == email) {
      name = data[i][1];
      colChar = data[i][2];
      break;
    }
  }

  var availableStars = [20, 30, 40, 50];
  var remainingRocket = 200;

  if (colChar !== "") {
    var sheetBet = ss.getSheetByName("Đặt cược");
    if (sheetBet) {
      var colNum = columnLetterToNumber(colChar);
      var userBets = sheetBet.getRange(3, colNum, 100, 1).getValues();
      for (var k = 0; k < userBets.length; k++) {
        var betStr = String(userBets[k][0]);
        var match = betStr.match(/⭐(\d+)/);
        if (match) {
          var starVal = parseInt(match[1]);
          var idx = availableStars.indexOf(starVal);
          if (idx !== -1) {
            availableStars.splice(idx, 1);
          }
        }
        var rocketMatch = betStr.match(/🚀(\d+)/);
        if (rocketMatch) {
          remainingRocket -= parseInt(rocketMatch[1], 10);
        }
      }
    }
  }

  return {
    name: name,
    email: email,
    availableStars: availableStars,
    remainingRocket: remainingRocket,
  };
}

function getMatches(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");
  var sheetPrediction = ss.getSheetByName("Dự đoán");

  var userData = sheetData.getRange("A2:C50").getValues();

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

  var infoRange = sheetInfo.getRange(3, 1, 100, 16).getValues();

  var userBets = sheetBet.getRange(3, userColNum, 100, 1).getValues();
  var userPredictions = sheetPrediction ? sheetPrediction.getRange(3, userColNum, 100, 1).getDisplayValues() : [];
  
  var sheetTaixiu = ss.getSheetByName("Tài xỉu");
  var userTaixius = sheetTaixiu ? sheetTaixiu.getRange(3, userColNum, 100, 1).getValues() : [];
  var taixiuRange = sheetTaixiu ? sheetTaixiu.getRange(3, 1, 100, 50).getValues() : [];

  var results = [];

  var predictionRange = sheetPrediction ? sheetPrediction.getRange(3, 1, 100, 50).getValues() : [];
  var validCols = [];
  for (var i = 0; i < userData.length; i++) {
    if (userData[i][0] && userData[i][2]) {
      validCols.push(columnLetterToNumber(String(userData[i][2]).trim()) - 1);
    }
  }

  var allBets = sheetBet.getRange(3, 1, 100, 50).getValues();

  for (var j = 0; j < infoRange.length; j++) {
    if (infoRange[j][0] !== "" && infoRange[j][8] === "Chưa đá") {
      var row = infoRange[j];
      row.push(String(userBets[j][0] || "").trim());
      row.push(userPredictions.length > j ? String(userPredictions[j][0] || "").trim() : "");
      
      var numPredictions = 0;
      if (predictionRange.length > j) {
        for (var k = 0; k < validCols.length; k++) {
          if (String(predictionRange[j][validCols[k]] || "").trim() !== "") {
            numPredictions++;
          }
        }
      }
      row.push(numPredictions); // row[18]

      var upperCount = 0;
      var lowerCount = 0;
      for (var k = 0; k < validCols.length; k++) {
        var betStr = String(allBets[j][validCols[k]] || "").trim();
        if (betStr.includes("Cửa trên")) upperCount++;
        else if (betStr.includes("Cửa dưới")) lowerCount++;
      }
      row.push(upperCount); // row[19]
      row.push(lowerCount); // row[20]
      row.push(validCols.length); // row[21]
      
      var taixiuRate = "";
      var userTx = "";
      var taiCount = 0;
      var xiuCount = 0;

      if (taixiuRange.length > j) {
        taixiuRate = taixiuRange[j][5] || ""; // col F (index 5)
        userTx = userTaixius.length > j ? String(userTaixius[j][0] || "").trim() : "";
        for (var k = 0; k < validCols.length; k++) {
          var txStr = String(taixiuRange[j][validCols[k]] || "").trim();
          if (txStr === "Tài") taiCount++;
          else if (txStr === "Xỉu") xiuCount++;
        }
      }
      row.push(taixiuRate); // row[22]
      row.push(userTx); // row[23]
      row.push(taiCount); // row[24]
      row.push(xiuCount); // row[25]
      
      results.push(row);
    }
  }

  return results;
}

function submitBet(email, stt, choice, prediction, taixiu) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");
  var sheetPrediction = ss.getSheetByName("Dự đoán");
  var sheetTaixiu = ss.getSheetByName("Tài xỉu");

  var userData = sheetData.getRange("A2:C50").getValues();

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

  var dataInfo = sheetInfo.getRange("A3:P100").getValues();

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
        parseInt(m[5], 10),
      );
    } else {
      matchTime = new Date(timeStr);
    }
  }

  if (new Date() > new Date(matchTime.getTime() - 1 * 60 * 1000)) {
    return "❌ Đã quá thời gian!";
  }

  try {
    var matchRegex = choice.match(/⭐(\d+)/);
    var requestedStar = matchRegex ? parseInt(matchRegex[1], 10) : null;

    var rocketRegex = choice.match(/🚀(\d+)/);
    var requestedRocket = rocketRegex ? parseInt(rocketRegex[1], 10) : null;

    if (requestedRocket) {
      // KIỂM TRA BỘI SỐ CỦA 10
      if (requestedRocket % 10 !== 0) {
        return "❌ Lỗi: Điểm cược tên lửa phải là bội số của 10 (ví dụ 20, 30, 40...)!";
      }

      // GIỚI HẠN VÒNG LOẠI TRỰC TIẾP (STT 69 là trận Nam Phi vs Canada - vòng 32 đội)
      var KNOCKOUT_START_STT = 69;
      if (parseInt(stt) < KNOCKOUT_START_STT) {
        return (
          "❌ Lỗi: Tên lửa hi vọng chỉ được dùng ở vòng loại trực tiếp (Từ trận " +
          KNOCKOUT_START_STT +
          ")!"
        );
      }

      if (requestedRocket < 20) {
        return "❌ Lỗi: Điểm cược tên lửa tối thiểu là 20!";
      }
      var remainingRocket = 200;
      var maxRow = sheetBet.getLastRow();
      if (maxRow < 3) maxRow = 3;

      var userBetsForRocket = sheetBet.getRange(3, userColNum, maxRow - 2, 1).getValues();

      for (var k = 0; k < userBetsForRocket.length; k++) {
        if (k + 3 !== row) {
          var betStrRocket = String(userBetsForRocket[k][0] || "");
          var existingRocket = betStrRocket.match(/🚀(\d+)/);
          if (existingRocket && existingRocket[1]) {
            remainingRocket -= parseInt(existingRocket[1], 10);
          }
        }
      }

      if (requestedRocket > remainingRocket) {
        return "❌ Lỗi: Bạn chỉ còn " + remainingRocket + " điểm tên lửa hi vọng!";
      }
    }

    if (requestedStar) {
      var availableStars = [20, 30, 40, 50];

      // Khắc phục triệt để lỗi getRange out of bounds bằng getLastRow
      var maxRow = sheetBet.getLastRow();
      if (maxRow < 3) maxRow = 3;

      var userBets = sheetBet.getRange(3, userColNum, maxRow - 2, 1).getValues();

      for (var k = 0; k < userBets.length; k++) {
        if (k + 3 !== row) {
          var betStr = String(userBets[k][0] || "");
          var existingMatch = betStr.match(/⭐(\d+)/);
          if (existingMatch && existingMatch[1]) {
            var starVal = parseInt(existingMatch[1], 10);
            var idx = availableStars.indexOf(starVal);
            if (idx !== -1) {
              availableStars.splice(idx, 1);
            }
          }
        }
      }

      if (availableStars.indexOf(requestedStar) === -1) {
        return "❌ Lỗi: Ngôi sao hy vọng này đã được sử dụng!";
      }
    }
  } catch (err) {
    return "❌ Lỗi Server nội bộ: " + err.toString();
  }

  sheetBet.getRange(row, userColNum).setValue(choice);

  if (parseInt(stt) >= 97) {
    if (prediction !== undefined && prediction !== "") {
      if (sheetPrediction) sheetPrediction.getRange(row, userColNum).setValue("'" + prediction);
    }
    if (taixiu !== undefined && taixiu !== "") {
      if (sheetTaixiu) sheetTaixiu.getRange(row, userColNum).setValue(taixiu);
    }
  }

  return "✅ Đã xác nhận: " + choice;
}

function submitScorePrediction(email, stt, prediction) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetPrediction = ss.getSheetByName("Dự đoán");
  var sheetData = ss.getSheetByName("Data");

  if (!sheetPrediction) {
    return "Lỗi: Không tìm thấy sheet Dự đoán!";
  }

  var userData = sheetData.getRange("A2:C50").getValues();

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

  var dataInfo = sheetInfo.getRange("A3:P100").getValues();

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

  if (new Date() > new Date(matchTime.getTime() - 1 * 60 * 1000)) {
    return "❌ Đã quá thời gian dự đoán!";
  }

  if (prediction === "") {
    sheetPrediction.getRange(row, userColNum).clearContent();
    return "✅ Đã hủy dự đoán tỉ số!";
  } else {
    // Thêm dấu nháy đơn để Google Sheets không tự động parse thành Ngày tháng (Date)
    sheetPrediction.getRange(row, userColNum).setValue("'" + prediction);
    return "✅ Đã lưu dự đoán tỉ số: " + prediction;
  }
}

function submitTaiXiu(email, stt, taixiu) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetTaixiu = ss.getSheetByName("Tài xỉu");
  var sheetData = ss.getSheetByName("Data");

  if (!sheetTaixiu) {
    return "Lỗi: Không tìm thấy sheet Tài xỉu!";
  }

  var userData = sheetData.getRange("A2:C50").getValues();

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

  var dataInfo = sheetInfo.getRange("A3:P100").getValues();

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

  if (new Date() > new Date(matchTime.getTime() - 1 * 60 * 1000)) {
    return "❌ Đã quá thời gian dự đoán!";
  }

  if (taixiu === "") {
    sheetTaixiu.getRange(row, userColNum).clearContent();
    return "✅ Đã hủy Tài Xỉu!";
  } else {
    sheetTaixiu.getRange(row, userColNum).setValue(taixiu);
    return "✅ Đã lưu Tài Xỉu: " + taixiu;
  }
}

// --- HÀM LẤY CÁC TRẬN QUÁ KHỨ MỚI THÊM VÀO ---
function getPastMatches(email) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");
  var sheetPrediction = ss.getSheetByName("Dự đoán");

  var userData = sheetData.getRange("A2:C50").getValues();

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

  var infoRange = sheetInfo.getRange(3, 1, 100, 16).getValues();

  var userBets = sheetBet.getRange(3, userColNum, 100, 1).getValues();
  var userPredictions = sheetPrediction ? sheetPrediction.getRange(3, userColNum, 100, 1).getDisplayValues() : [];
  
  var sheetTaixiu = ss.getSheetByName("Tài xỉu");
  var userTaixius = sheetTaixiu ? sheetTaixiu.getRange(3, userColNum, 100, 1).getValues() : [];
  var taixiuRange = sheetTaixiu ? sheetTaixiu.getRange(3, 1, 100, 50).getValues() : [];

  var results = [];

  var predictionRange = sheetPrediction ? sheetPrediction.getRange(3, 1, 100, 50).getValues() : [];
  var validCols = [];
  for (var i = 0; i < userData.length; i++) {
    if (userData[i][0] && userData[i][2]) {
      validCols.push(columnLetterToNumber(String(userData[i][2]).trim()) - 1);
    }
  }

  var allBets = sheetBet.getRange(3, 1, 100, 50).getValues();

  for (var j = 0; j < infoRange.length; j++) {
    // Điều kiện: Lấy những trận đã có số STT và Trạng thái KHÁC "Chưa đá"
    if (infoRange[j][0] !== "" && infoRange[j][8] !== "Chưa đá") {
      var row = infoRange[j];
      row.push(String(userBets[j][0] || "").trim());
      row.push(userPredictions.length > j ? String(userPredictions[j][0] || "").trim() : "");
      
      var numPredictions = 0;
      if (predictionRange.length > j) {
        for (var k = 0; k < validCols.length; k++) {
          if (String(predictionRange[j][validCols[k]] || "").trim() !== "") {
            numPredictions++;
          }
        }
      }
      row.push(numPredictions); // row[18]

      var upperCount = 0;
      var lowerCount = 0;
      for (var k = 0; k < validCols.length; k++) {
        var betStr = String(allBets[j][validCols[k]] || "").trim();
        if (betStr.includes("Cửa trên")) upperCount++;
        else if (betStr.includes("Cửa dưới")) lowerCount++;
      }
      row.push(upperCount); // row[19]
      row.push(lowerCount); // row[20]
      row.push(validCols.length); // row[21]
      
      var taixiuRate = "";
      var userTx = "";
      var taiCount = 0;
      var xiuCount = 0;

      if (taixiuRange.length > j) {
        taixiuRate = taixiuRange[j][5] || "";
        userTx = userTaixius.length > j ? String(userTaixius[j][0] || "").trim() : "";
        for (var k = 0; k < validCols.length; k++) {
          var txStr = String(taixiuRange[j][validCols[k]] || "").trim();
          if (txStr === "Tài") taiCount++;
          else if (txStr === "Xỉu") xiuCount++;
        }
      }
      row.push(taixiuRate); // row[22]
      row.push(userTx); // row[23]
      row.push(taiCount); // row[24]
      row.push(xiuCount); // row[25]
      
      results.push(row);
    }
  }

  return results;
}

// --- HÀM LẤY DỮ LIỆU BẢNG VÀNG ---
function getLeaderboard() {
  var cache = CacheService.getScriptCache();
  var cached = cache.get("leaderboard_data");
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch (e) {
      // Ignore cache if parsing fails
    }
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Bảng vàng");
  var sheetInfo = ss.getSheetByName("Trận đấu");
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetData = ss.getSheetByName("Data");

  if (!sheet) return { error: "Không tìm thấy sheet Bảng vàng" };

  var dataRange = sheet.getRange("A3:L50").getValues();
  var leaderboard = [];

  // Lấy dữ liệu Trận đấu và Đặt cược để tính danh hiệu
  var infoRange = sheetInfo ? sheetInfo.getRange(3, 1, 100, 16).getValues() : [];
  var betRange = sheetBet ? sheetBet.getRange(3, 1, 100, 50).getValues() : [];
  var sheetPrediction = ss.getSheetByName("Dự đoán");
  var predictionRange = sheetPrediction ? sheetPrediction.getRange(3, 1, 100, 50).getDisplayValues() : [];
  var sheetTaixiu = ss.getSheetByName("Tài xỉu");
  var taixiuRange = sheetTaixiu ? sheetTaixiu.getRange(3, 1, 100, 50).getValues() : [];
  var userData = sheetData ? sheetData.getRange("A2:C50").getValues() : [];

  // Xây dựng object user để lưu các chỉ số tính danh hiệu
  var userStats = {};
  for (var u = 0; u < userData.length; u++) {
    if (userData[u][0]) {
      userStats[userData[u][1]] = {
        colChar: String(userData[u][2]).trim(),
        cuaDuoiCount: 0,
        nguocDongPoints: 0,
        usedStar: false,
        usedRocket: false,
        starImpact: 0,
        rocketImpact: 0,
        remainingRocket: 200,
        predictionPoints: 0,
        taixiuPoints: 0,
        votingPoints: 0,
      };
    }
  }

  for (var pName in userStats) {
    if (userStats[pName].colChar) {
      userStats[pName].colIndex = columnLetterToNumber(userStats[pName].colChar) - 1;
    }
  }

  // Tính toán chỉ số Tâm Linh và Ngược Dòng
  for (var j = 0; j < infoRange.length; j++) {
    var stt = infoRange[j][0];
    if (stt === "") continue;

    var homeTeam = String(infoRange[j][4] || "").trim();
    var awayTeam = String(infoRange[j][5] || "").trim();
    var roundName = String(infoRange[j][2] || "").trim();
    var isOldStage = roundName.toLowerCase().includes("vòng bảng") || roundName.toLowerCase().includes("vòng 32");
    var upperTeam = String(infoRange[j][12] || "").trim();
    var matchStatus = String(infoRange[j][8] || "").trim();

    var winningTeam = String(infoRange[j][10] || "").trim();
    var actualWinningChoice = "";
    if (winningTeam && matchStatus.includes("Kết thúc")) {
      if (winningTeam === "Hòa" || winningTeam === "Hòa kèo") {
        actualWinningChoice = "Hòa";
      } else {
        actualWinningChoice = winningTeam === upperTeam ? "Cửa trên" : "Cửa dưới";
      }
    }

    var upperCount = 0;
    var lowerCount = 0;
    var totalBets = 0;
    var matchBets = {};

    var matchPredictions = {};
    var numPredictions = 0;
    var correctPredictions = [];
    var actualHomeScore = parseInt(infoRange[j][6]);
    var actualAwayScore = parseInt(infoRange[j][7]);
    var hasValidActualScore = !isNaN(actualHomeScore) && !isNaN(actualAwayScore) && matchStatus.includes("Kết thúc");
    var actualScoreStr = hasValidActualScore ? (actualHomeScore + "-" + actualAwayScore) : "";

    var matchTaixius = {};
    var taiCountForMatch = 0;
    var xiuCountForMatch = 0;
    var actualTaixiu = "";
    if (hasValidActualScore && taixiuRange.length > j) {
      var rateStr = String(taixiuRange[j][5] || "").replace(",", ".");
      var taixiuRate = parseFloat(rateStr);
      if (!isNaN(taixiuRate)) {
        var totalGoals = actualHomeScore + actualAwayScore;
        if (totalGoals > taixiuRate) actualTaixiu = "Tài";
        else if (totalGoals < taixiuRate) actualTaixiu = "Xỉu";
      }
    }

    for (var pName in userStats) {
      var cIdx = userStats[pName].colIndex;
      if (cIdx >= 0) {
        // Xử lý Dự đoán Tỉ số
        if (predictionRange[j] && predictionRange[j][cIdx]) {
          var predVal = String(predictionRange[j][cIdx]).trim();
          if (predVal) {
            matchPredictions[pName] = predVal;
            numPredictions++;
            if (hasValidActualScore && predVal === actualScoreStr) {
              correctPredictions.push(pName);
            }
          }
        }

        // Xử lý Tài Xỉu
        if (taixiuRange.length > j && taixiuRange[j][cIdx]) {
          var txVal = String(taixiuRange[j][cIdx]).trim();
          if (txVal === "Tài" || txVal === "Xỉu") {
            matchTaixius[pName] = txVal;
            if (txVal === "Tài") taiCountForMatch++;
            else if (txVal === "Xỉu") xiuCountForMatch++;
          }
        }

        // Xử lý Đặt cược
        if (betRange[j] && betRange[j][cIdx]) {
          var betVal = String(betRange[j][cIdx]).trim();
        matchBets[pName] = betVal;

        var rMatch = betVal.match(/🚀(\d+)/);
        if (rMatch) {
          userStats[pName].remainingRocket -= parseInt(rMatch[1], 10);
        }

        var cleanedBet = betVal.replace(/⭐\d+/, "").replace(/🚀\d+/, "").trim();

        if (actualWinningChoice) {
          var isLose = cleanedBet !== actualWinningChoice && actualWinningChoice !== "Hòa";
          var isWin = cleanedBet === actualWinningChoice;
          if (isLose) {
            if (betVal.includes("⭐")) userStats[pName].usedStar = true;
            if (betVal.includes("🚀")) userStats[pName].usedRocket = true;
          }
          if (isOldStage) {
            if (isWin) userStats[pName].votingPoints += 10;
            else if (isLose) userStats[pName].votingPoints -= 10;
          }
          if (isWin || isLose) {
            var starMatch = betVal.match(/⭐(\d+)/);
            if (starMatch) {
              var pts = parseInt(starMatch[1], 10) - 10;
              userStats[pName].starImpact += isWin ? pts : -pts;
            }
            var rocketMatch = betVal.match(/🚀(\d+)/);
            if (rocketMatch) {
              var pts = parseInt(rocketMatch[1], 10) - 10;
              userStats[pName].rocketImpact += isWin ? pts : -pts;
            }
          }
        }

        if (cleanedBet === "Cửa dưới") userStats[pName].cuaDuoiCount++;

        if (cleanedBet === "Cửa trên") upperCount++;
        else if (cleanedBet === "Cửa dưới") lowerCount++;

        totalBets++;
        }
      }
    }

    // Tính điểm Dự đoán Tỉ số
    if (hasValidActualScore && numPredictions > 0) {
      var sttNum = parseInt(stt);
      var ptsPerPerson = (sttNum >= 97) ? 20 : 10;
      var pool = numPredictions * ptsPerPerson;
      for (var p in matchPredictions) {
        if (correctPredictions.length > 0) {
          if (correctPredictions.includes(p)) {
            userStats[p].predictionPoints += Math.floor(pool / correctPredictions.length) - ptsPerPerson;
          } else {
            userStats[p].predictionPoints -= ptsPerPerson;
          }
        }
      }
    }

    // Tính điểm Tài Xỉu
    if (hasValidActualScore && actualTaixiu !== "") {
      var sttNum = parseInt(stt);
      if (sttNum >= 97) {
        var winCount = actualTaixiu === "Tài" ? taiCountForMatch : xiuCountForMatch;
        var loseCount = actualTaixiu === "Tài" ? xiuCountForMatch : taiCountForMatch;

        var winPts = winCount > 0 ? Math.round(300 / winCount) : 0;
        var losePts = loseCount > 0 ? Math.round(300 / loseCount) : 0;

        for (var p in matchTaixius) {
          if (matchTaixius[p] === actualTaixiu) {
             userStats[p].taixiuPoints += winPts;
          } else if (matchTaixius[p] !== "") {
             userStats[p].taixiuPoints -= losePts;
          }
        }
      }
    }

    // Trận có kết quả và có người cược
    if (actualWinningChoice && totalBets > 0) {
      var winningChoiceCount = actualWinningChoice === "Cửa trên" ? upperCount : lowerCount;
      var winningPct = winningChoiceCount / totalBets;

      // Nếu số người chọn ĐÚNG <= 30% (tức >= 70% chọn sai) => Trận cú lừa
      if (winningPct <= 0.3) {
        for (var pName in matchBets) {
          if (matchBets[pName] === actualWinningChoice) {
            userStats[pName].nguocDongPoints++;
          }
        }
      }
    }
  }

  for (var i = 0; i < dataRange.length; i++) {
    var playerName = String(dataRange[i][0]).trim();
    if (playerName === "") continue;

    var wins = Number(dataRange[i][4]) || 0;
    var losses = Number(dataRange[i][5]) || 0;
    var total = wins + losses;
    var totalScore = Number(dataRange[i][2]) || 0;

    if (userStats[playerName]) {
      totalScore += userStats[playerName].predictionPoints;
      totalScore += userStats[playerName].taixiuPoints;
    }

    var winRate = total > 0 ? wins / total : 0;
    var loseRate = total > 0 ? losses / total : 0;

    var maxWinStreak = Number(dataRange[i][10]) || 0;
    var maxLoseStreak = Number(dataRange[i][11]) || 0;

    var hopeStarImpact = userStats[playerName] ? (userStats[playerName].starImpact + userStats[playerName].rocketImpact) : 0;

    leaderboard.push({
      name: playerName,
      rank: dataRange[i][1],
      totalScore: totalScore,
      winMatches: wins,
      loseMatches: losses,
      winRate: winRate,
      loseRate: loseRate,
      currentWinStreak: dataRange[i][8],
      currentLoseStreak: dataRange[i][9],
      maxWinStreak: maxWinStreak,
      maxLoseStreak: maxLoseStreak,
      badges: [],
      _cuaDuoiCount: userStats[playerName] ? userStats[playerName].cuaDuoiCount : 0,
      _nguocDongPoints: userStats[playerName] ? userStats[playerName].nguocDongPoints : 0,
      _usedStar: userStats[playerName] ? userStats[playerName].usedStar : false,
      _usedRocket: userStats[playerName] ? userStats[playerName].usedRocket : false,
      _hopeStarImpact: hopeStarImpact,
      _starImpact: userStats[playerName] ? userStats[playerName].starImpact : 0,
      _rocketImpact: userStats[playerName] ? userStats[playerName].rocketImpact : 0,
      _votingPoints: userStats[playerName] ? userStats[playerName].votingPoints : 0,
      _poolPoints: Number(dataRange[i][2] || 0) - (userStats[playerName] ? userStats[playerName].votingPoints : 0) - (userStats[playerName] ? userStats[playerName].starImpact : 0) - (userStats[playerName] ? userStats[playerName].rocketImpact : 0),
      _scorePredictionPoints: userStats[playerName] ? userStats[playerName].predictionPoints : 0,
      _taixiuPoints: userStats[playerName] ? userStats[playerName].taixiuPoints : 0,
      remainingRocket: userStats[playerName] ? userStats[playerName].remainingRocket : 200,
    });
  }

  // Xếp hạng lại theo yêu cầu:
  leaderboard.sort(function (a, b) {
    var scoreDiff = Number(b.totalScore || 0) - Number(a.totalScore || 0);
    if (scoreDiff !== 0) return scoreDiff;

    var winStreakDiff = Number(b.maxWinStreak || 0) - Number(a.maxWinStreak || 0);
    if (winStreakDiff !== 0) return winStreakDiff;

    var loseStreakDiff = Number(a.maxLoseStreak || 0) - Number(b.maxLoseStreak || 0);
    return loseStreakDiff;
  });

  // Cập nhật lại thuộc tính rank
  for (var j = 0; j < leaderboard.length; j++) {
    if (j > 0) {
      var prev = leaderboard[j - 1];
      var curr = leaderboard[j];
      if (
        Number(curr.totalScore || 0) === Number(prev.totalScore || 0) &&
        Number(curr.maxWinStreak || 0) === Number(prev.maxWinStreak || 0) &&
        Number(curr.maxLoseStreak || 0) === Number(prev.maxLoseStreak || 0)
      ) {
        curr.rank = prev.rank;
      } else {
        curr.rank = j + 1;
      }
    } else {
      leaderboard[j].rank = 1;
    }
  }

  // Trao danh hiệu
  var highestMaxWinStreak = -1;
  var highestMaxLoseStreak = -1;
  var lowestScore = 999999;
  var highestCuaDuoi = -1;
  var highestNguocDong = -1;

  for (var k = 0; k < leaderboard.length; k++) {
    var p = leaderboard[k];
    if (p.maxWinStreak > highestMaxWinStreak) highestMaxWinStreak = p.maxWinStreak;
    if (p.maxLoseStreak > highestMaxLoseStreak) highestMaxLoseStreak = p.maxLoseStreak;
    if (p.totalScore < lowestScore) lowestScore = p.totalScore;
    if (p._cuaDuoiCount > highestCuaDuoi) highestCuaDuoi = p._cuaDuoiCount;
    if (p._nguocDongPoints > highestNguocDong) highestNguocDong = p._nguocDongPoints;
  }

  for (var k = 0; k < leaderboard.length; k++) {
    var p = leaderboard[k];
    if (highestMaxWinStreak >= 3 && p.maxWinStreak === highestMaxWinStreak) {
      p.badges.push("🔮 Thánh Tiên Tri");
    }
    if (highestMaxLoseStreak >= 3 && p.maxLoseStreak === highestMaxLoseStreak) {
      p.badges.push("🐧 Pele Nhập");
    }
    if (lowestScore < 0 && p.totalScore === lowestScore) {
      p.badges.push("💸 Nhà Từ Thiện");
    }
    if (highestCuaDuoi >= 5 && p._cuaDuoiCount === highestCuaDuoi) {
      p.badges.push("🙏 Hệ Tâm Linh");
    }
    if (highestNguocDong >= 1 && p._nguocDongPoints === highestNguocDong) {
      p.badges.push("🐟 Trùm Ngược Dòng");
    }
    var isStarVictim = p._starImpact < 0;
    var isRocketVictim = p._rocketImpact < 0;

    if (isStarVictim && isRocketVictim) {
      p.badges.push("🤡 Siêu Nạn Nhân");
    } else {
      if (isRocketVictim) {
        p.badges.push("🤡 Nạn Nhân Của Tên Lửa Hi Vọng");
      }
      if (isStarVictim) {
        p.badges.push("🤡 Nạn Nhân Của Sao Hi Vọng");
      }
    }
  }

  try {
    cache.put("leaderboard_data", JSON.stringify(leaderboard), 60); // Cache for 60 seconds
  } catch (e) {
    // ignore
  }

  return leaderboard;
}

function columnLetterToNumber(col) {
  var out = 0;

  for (var i = 0; i < col.length; i++) {
    out = out * 26 + (col.charCodeAt(i) - 64);
  }

  return out;
}

// --- HÀM LẤY CHI TIẾT BÌNH CHỌN CỦA TẤT CẢ NGƯỜI CHƠI CHO 1 TRẬN ---
function getMatchDetail(stt) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetBet = ss.getSheetByName("Đặt cược");
  var sheetPrediction = ss.getSheetByName("Dự đoán");
  var sheetData = ss.getSheetByName("Data");

  if (!sheetBet || !sheetData) return { error: "Không tìm thấy sheet" };

  // Lấy danh sách tất cả người chơi (email, tên, cột bình chọn)
  var userData = sheetData.getRange("A2:C50").getValues();

  // Tìm dòng tương ứng với STT trong sheet Đặt cược (cột A, dữ liệu từ hàng 3)
  var sttValues = sheetBet.getRange(3, 1, 100, 1).getValues();
  var matchRow = -1;

  for (var j = 0; j < sttValues.length; j++) {
    if (String(sttValues[j][0]).trim() === String(stt).trim()) {
      matchRow = j + 3; // row number 1-indexed trong spreadsheet
      break;
    }
  }

  if (matchRow === -1) return { error: "Không tìm thấy trận #" + stt };

  var result = [];

  for (var i = 0; i < userData.length; i++) {
    var email = userData[i][0];
    var name = userData[i][1];
    var colChar = String(userData[i][2] || "").trim();

    if (!email || !colChar) continue;

    var colNum = columnLetterToNumber(colChar);
    var choice = String(sheetBet.getRange(matchRow, colNum).getValue() || "").trim();
    var prediction = sheetPrediction ? String(sheetPrediction.getRange(matchRow, colNum).getDisplayValue() || "").trim() : "";

    result.push({ name: name, choice: choice, prediction: prediction });
  }

  return result;
}

// --- HÀM ĐỒNG BỘ TỶ SỐ TRỰC TIẾP TỪ FOOTBALL-DATA.ORG ---
function syncLiveScores() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetInfo = ss.getSheetByName("Trận đấu");

  // Đọc dữ liệu nhanh từ Sheet trước để kiểm tra trạng thái
  var infoRange = sheetInfo.getRange("A3:P100").getValues();
  var shouldFetchApi = false;
  var now = new Date();

  for (var j = 0; j < infoRange.length; j++) {
    var stt = String(infoRange[j][0]).trim();
    if (stt === "") continue;

    var timeRaw = infoRange[j][3];
    var matchTime;
    if (timeRaw instanceof Date) {
      matchTime = timeRaw;
    } else {
      var timeStr = String(timeRaw).trim();
      var m = timeStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})/);
      if (m) {
        matchTime = new Date(
          parseInt(m[3]),
          parseInt(m[2]) - 1,
          parseInt(m[1]),
          parseInt(m[4]),
          parseInt(m[5]),
        );
      } else {
        matchTime = new Date(timeStr);
      }
    }

    var matchStatus = String(infoRange[j][8]).trim();

    if (matchStatus === "Đang đá" || (matchStatus === "Chưa đá" && matchTime <= now)) {
      shouldFetchApi = true;
      break;
    }
  }

  // Thoát ngay nếu không có trận nào đang diễn ra hoặc đến giờ đá
  if (!shouldFetchApi) return;

  var API_TOKEN = "53fcbf73996344a5889d2f8fd6830192";
  // Bạn có thể thêm tham số query để chỉ lấy những trận hôm nay
  var url = "https://api.football-data.org/v4/matches";

  var options = {
    method: "get",
    headers: {
      "X-Auth-Token": API_TOKEN,
    },
    muteHttpExceptions: true,
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var data = JSON.parse(response.getContentText());

    if (!data.matches || data.matches.length === 0) return;

    // Từ điển map tên tiếng Anh sang tiếng Việt (Google Sheet)
    // Cần bổ sung nếu tên trong Sheet khác với tên tiếng Việt ở đây
    // Bảng quy đổi cho các đội bóng nếu API trả về tên tiếng Anh khác với Google Sheet
    var teamDictionary = {
      "United States": "USA",
      "Bosnia-Herzegovina": "Bosnia & Herzegovina",
      "Cape Verde Islands": "Cape Verde",
      "Congo DR": "DR Congo",
      Czechia: "Czech Republic",
    };

    var getVnName = function (enName) {
      // Vì sheet dùng tên tiếng Anh, ta sẽ lấy tên gốc từ API,
      // chỉ đổi tên ở những trường hợp API viết khác sheet (như USA vs United States)
      return teamDictionary[enName] || enName;
    };

    var scoresRange = sheetInfo.getRange(3, 7, infoRange.length, 2);
    var scoresData = scoresRange.getValues();
    var hasChanges = false;

    for (var i = 0; i < data.matches.length; i++) {
      var match = data.matches[i];

      // Chỉ quan tâm trận đang đá, tạm dừng hoặc vừa kết thúc
      if (match.status === "IN_PLAY" || match.status === "PAUSED" || match.status === "FINISHED") {
        var apiHome = getVnName(match.homeTeam.name);
        var apiAway = getVnName(match.awayTeam.name);

        var homeScore = match.score.fullTime.home !== null ? match.score.fullTime.home : 0;
        var awayScore = match.score.fullTime.away !== null ? match.score.fullTime.away : 0;

        // Dò trong sheet để cập nhật
        for (var j = 0; j < infoRange.length; j++) {
          var sheetHome = String(infoRange[j][4]).trim();
          var sheetAway = String(infoRange[j][5]).trim();
          var sheetStatus = String(infoRange[j][8]).trim();

          if (sheetHome === apiHome && sheetAway === apiAway) {
            // Nếu trận đã kết thúc và sheet cũng đã ghi nhận thì bỏ qua để không tốn thời gian ghi
            if (
              match.status === "FINISHED" &&
              (sheetStatus === "Kết thúc" ||
                sheetStatus === "Đã kết thúc" ||
                sheetStatus === "Đã xong")
            ) {
              break;
            }

            // Cập nhật vào mảng bộ nhớ thay vì ghi trực tiếp xuống sheet
            if (scoresData[j][0] !== homeScore || scoresData[j][1] !== awayScore) {
              scoresData[j][0] = homeScore;
              scoresData[j][1] = awayScore;
              hasChanges = true;
            }
            
            // Cập nhật trạng thái vào cột I (Cột 9) nếu cần (hiện tại đang bị comment)
            // sheetInfo.getRange(j + 3, 9).setValue(newStatus);
            break;
          }
        }
      }
    }

    if (hasChanges) {
      scoresRange.setValues(scoresData);
    }
  } catch (e) {
    console.error("Live score sync failed:", e);
  }
}

// --- HÀM HỖ TRỢ TỰ ĐỘNG CÀI ĐẶT TRIGGER CẬP NHẬT TỈ SỐ ---
function setupAutoSyncTrigger() {
  // Xóa các trigger cũ nếu có để tránh trùng lặp
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "syncLiveScores") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Tạo trigger mới chạy mỗi 1 phút
  ScriptApp.newTrigger("syncLiveScores").timeBased().everyMinutes(1).create();

  return "Đã cài đặt tự động cập nhật tỉ số mỗi 1 phút thành công!";
}

// --- HÀM LẤY DỮ LIỆU ĐỂ VẼ BIỂU ĐỒ ---
function getChartData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetScore = ss.getSheetByName("Tính điểm");
  var sheetData = ss.getSheetByName("Data");

  if (!sheetScore || !sheetData) return { error: "Không tìm thấy sheet Tính điểm" };

  var scoreData = sheetScore.getRange("A3:AZ200").getValues();
  var userData = sheetData.getRange("A2:C100").getValues();

  var users = [];
  for (var u = 0; u < userData.length; u++) {
    var email = userData[u][0];
    var name = userData[u][1];
    var colChar = userData[u][2];
    if (email && name && colChar) {
      users.push({
        name: name,
        colIndex: columnLetterToNumber(colChar) - 1,
        runningScore: 0,
      });
    }
  }

  var categories = ["Bắt đầu"];
  var seriesPoints = {};
  var seriesRanks = {};

  for (var i = 0; i < users.length; i++) {
    seriesPoints[users[i].name] = [0];
    seriesRanks[users[i].name] = [1];
  }

  for (var i = 0; i < scoreData.length; i++) {
    var stt = String(scoreData[i][0]).trim();
    if (stt === "") continue;

    var homeTeam = String(scoreData[i][2]).trim();
    var awayTeam = String(scoreData[i][3]).trim();
    var status = String(scoreData[i][4]).trim();

    if (!status.includes("Kết thúc")) {
      continue;
    }

    var matchLabel = homeTeam + "-" + awayTeam;
    categories.push(matchLabel);

    var currentScores = [];
    for (var u = 0; u < users.length; u++) {
      var pt = Number(scoreData[i][users[u].colIndex]) || 0;
      users[u].runningScore += pt;
      seriesPoints[users[u].name].push(users[u].runningScore);
      currentScores.push({ name: users[u].name, score: users[u].runningScore });
    }

    // Tính rank
    currentScores.sort(function (a, b) {
      return b.score - a.score;
    });

    var currentRank = 1;
    for (var r = 0; r < currentScores.length; r++) {
      if (r > 0 && currentScores[r].score === currentScores[r - 1].score) {
        // cùng rank
      } else {
        currentRank = r + 1;
      }
      var pName = currentScores[r].name;
      seriesRanks[pName].push(currentRank);
    }
  }

  var formattedPointsSeries = [];
  var formattedRanksSeries = [];
  for (var i = 0; i < users.length; i++) {
    var name = users[i].name;
    formattedPointsSeries.push({
      name: name,
      data: seriesPoints[name],
    });
    formattedRanksSeries.push({
      name: name,
      data: seriesRanks[name],
    });
  }

  return {
    categories: categories,
    pointsSeries: formattedPointsSeries,
    ranksSeries: formattedRanksSeries,
  };
}
