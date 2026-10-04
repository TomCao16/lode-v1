function readSources() {

    const date = document.getElementById("dateInput").value;

    const urls = [];

    for (let i = 1; i <= 6; i++) {

        const value =
            document.getElementById("url" + i).value.trim();

        if (value) {
            urls.push(value);
        }
    }

    const status =
        document.getElementById("status");

    if (!date) {

        status.innerHTML =
            "⚠️ Vui lòng chọn ngày.";

        return;
    }

    if (urls.length === 0) {

        status.innerHTML =
            "⚠️ Vui lòng nhập ít nhất 1 nguồn.";

        return;
    }

    status.innerHTML =
        "⏳ Đã nhận " +
        urls.length +
        " nguồn. V1 đang chờ kết nối bộ đọc nguồn.";

    document.getElementById("twoDigitResult").innerHTML =
        "Chưa đọc dữ liệu thật.";

    document.getElementById("threeDigitResult").innerHTML =
        "Chưa đọc dữ liệu thật.";

    document.getElementById("consensusResult").innerHTML =
        "Chưa có dữ liệu đồng thuận.";

}
