function updateOddsDaily() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Trận đấu");
  var apiKey = "9a8500409b0dfc44a3333e84dc4c36c3";
  var sport = "soccer_fifa_world_cup";
  var regions = "eu";
  var markets = "spreads";

  var url = `https://api.the-odds-api.com/v4/sports/${sport}/odds?apiKey=${apiKey}&regions=${regions}&markets=${markets}&oddsFormat=decimal`;

  try {
    var response = UrlFetchApp.fetch(encodeURI(url.trim()));
    var json = JSON.parse(response.getContentText());

    // Lấy dữ liệu từ dòng 3 trở đi
    var lastRow = sheet.getLastRow();
    if (lastRow < 3) return;

    var idValues = sheet.getRange(3, 2, lastRow - 2, 1).getValues();
    var idToRowMap = {};
    for (var i = 0; i < idValues.length; i++) {
      if (idValues[i][0]) idToRowMap[idValues[i][0].toString().trim()] = i + 3;
    }

    var now = new Date();
    var updateCount = 0;

    for (var i = 0; i < json.length; i++) {
      var match = json[i];
      var matchId = match.id;
      var vnTime = new Date(match.commence_time);

      // Chỉ cập nhật nếu là trận tương lai và tồn tại trong danh sách
      if (vnTime > now && idToRowMap[matchId]) {
        var row = idToRowMap[matchId];
        var status = sheet.getRange(row, 9).getValue(); // Cột I: Trạng thái

        if (status === "Chưa đá") {
          var bm =
            match.bookmakers.find((b) => b.key.toLowerCase() === "pinnacle") || match.bookmakers[0];
          if (bm && bm.markets && bm.markets.length > 0) {
            var market = bm.markets[0];
            var out1 = market.outcomes[0];
            var out2 = market.outcomes[1];

            var favoriteTeam = out1.point < 0 ? out1.name : out2.name;
            var handicapPoint = Math.abs(out1.point);

            if (Number.isInteger(handicapPoint)) {
              handicapPoint += 0.1;
            }

            // Cập nhật Cột L, M, N (3 cột)
            sheet.getRange(row, 12, 1, 3).setValues([[bm.title, favoriteTeam, handicapPoint]]);

            // Ghi thời gian cập nhật vào cột Q (Cột 17) cho từng dòng
            sheet
              .getRange(row, 17)
              .setValue(Utilities.formatDate(new Date(), "GMT+7", "HH:mm dd/MM/yyyy"));

            updateCount++;
          }
        }
      }
    }

    console.log("Đã cập nhật tỷ lệ chấp và thời gian cho " + updateCount + " trận.");
  } catch (error) {
    console.error("Lỗi cập nhật: " + error.toString());
  }
}
