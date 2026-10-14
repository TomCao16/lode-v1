
const WORKER_BASE = "https://lode-v1-reader.czcaonguyen.workers.dev";

function getSourceId(url) {
    try {
        const host = new URL(url).hostname.toLowerCase();

        if (
            host === "xosothantai.com" ||
            host.endsWith(".xosothantai.com") ||
            host === "quaythuxosothantai.com" ||
            host.endsWith(".quaythuxosothantai.com")
        ) {
            return "quaythu";
        }

        return null;
    } catch {
        return null;
    }
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function countBySource(results, field) {
    const counts = new Map();

    for (const item of results) {
        const source = item.source_id || item.source_name || "";
        const numbers = Array.isArray(item[field]) ? item[field] : [];

        for (const number of numbers) {
            const n = String(number).trim();

            if (!n) continue;

            if (!counts.has(n)) {
                counts.set(n, new Set());
            }

            if (source) counts.get(n).add(source);
        }
    }

    return [...counts.entries()]
        .map(([number, sources]) => ({
            number,
            count: sources.size
        }))
        .sort((a, b) =>
            b.count - a.count || a.number.localeCompare(b.number)
        );
}

async function readSources() {
    const date = document.getElementById("dateInput").value;
    const status = document.getElementById("status");
    const button = document.getElementById("readButton");

    const urls = [];

    for (let i = 1; i <= 6; i++) {
        const value = document.getElementById("url" + i).value.trim();

        if (value) urls.push(value);
    }

    if (!date) {
        status.textContent = "⚠️ Vui lòng chọn ngày.";
        return;
    }

    if (urls.length === 0) {
        status.textContent = "⚠️ Vui lòng nhập ít nhất 1 nguồn.";
        return;
    }

    const sources = [];
    const unsupported = [];

    for (const url of urls) {
        const sourceId = getSourceId(url);

        if (sourceId) {
            if (!sources.some(s => s.sourceId === sourceId)) {
                sources.push({ url, sourceId });
            }
        } else {
            unsupported.push(url);
        }
    }

    if (sources.length === 0) {
        status.innerHTML =
            "⚠️ Chưa có nguồn nào được kết nối với Worker.<br>" +
            "Hiện tại app.js mới nhận diện nguồn Quay Thử Xổ Số Thần Tài.";
        return;
    }

    button.disabled = true;

    document.getElementById("twoDigitResult").textContent = "Đang đọc...";
    document.getElementById("threeDigitResult").textContent = "Đang đọc...";
    document.getElementById("consensusResult").textContent = "Đang đọc...";

    status.textContent = "⏳ Đang gọi Cloudflare Worker...";

    try {
        const outcomes = await Promise.all(
            sources.map(async source => {
                const endpoint =
                    WORKER_BASE +
                    "/extract?date=" + encodeURIComponent(date) +
                    "&source_id=" + encodeURIComponent(source.sourceId);

                const response = await fetch(endpoint);

                if (!response.ok) {
                    throw new Error(
                        "Nguồn " + source.sourceId +
                        " trả về HTTP " + response.status
                    );
                }

                const data = await response.json();

                if (!Array.isArray(data.results)) {
                    throw new Error(
                        "Worker không trả về danh sách results. " +
                        (data.message || data.error || "")
                    );
                }

                return { source, data };
            })
        );

        const results = [];
        const errors = [];

        for (const outcome of outcomes) {
            const data = outcome.data;

            if (
                data.status &&
                !["PASS", "OK", "SUCCESS"].includes(
                    String(data.status).toUpperCase()
                )
            ) {
                errors.push(
                    outcome.source.sourceId + ": " +
                    (data.message || data.error || data.status)
                );
                continue;
            }

            for (const item of data.results) {
                results.push({
                    ...item,
                    source_id: item.source_id || outcome.source.sourceId,
                    source_name:
                        item.source_name ||
                        outcome.source.sourceId
                });
            }
        }

        if (results.length === 0) {
            throw new Error(
                errors.join("; ") || "Nguồn không có dữ liệu kết quả."
            );
        }

        const twoDigit = countBySource(results, "lo_2_so");
        const threeDigit = countBySource(results, "lo_3_so");

        document.getElementById("twoDigitResult").innerHTML =
            twoDigit.length
                ? twoDigit.map(x =>
                    "<span>" + escapeHtml(x.number) + "</span>"
                ).join(" · ")
                : "Không có dữ liệu lô 2 số.";

        document.getElementById("threeDigitResult").innerHTML =
            threeDigit.length
                ? threeDigit.map(x =>
                    "<span>" + escapeHtml(x.number) + "</span>"
                ).join(" · ")
                : "Không có dữ liệu lô 3 số.";

        const consensus = twoDigit.map(x =>
            "<div><b>" + escapeHtml(x.number) +
            "</b> — " + x.count + " nguồn</div>"
        );

        document.getElementById("consensusResult").innerHTML =
            consensus.length
                ? consensus.join("")
                : "Chưa có dữ liệu đồng thuận.";

        let message =
            "✅ Đã đọc được " + results.length +
            " bản ghi từ " + outcomes.length + " nguồn kết nối.";

        if (unsupported.length) {
            message +=
                "<br>⚠️ Chưa hỗ trợ " + unsupported.length +
                " URL khác. Các URL này chưa được đọc.";
        }

        if (errors.length) {
            message += "<br>⚠️ " + errors.map(escapeHtml).join("<br>");
        }

        status.innerHTML = message;

    } catch (error) {
        document.getElementById("twoDigitResult").textContent =
            "Chưa lấy được dữ liệu.";

        document.getElementById("threeDigitResult").textContent =
            "Chưa lấy được dữ liệu.";

        document.getElementById("consensusResult").textContent =
            "Chưa có dữ liệu đồng thuận.";

        status.innerHTML =
            "❌ Đọc nguồn thất bại: " + escapeHtml(error.message) +
            "<br>Nếu báo Failed to fetch, cần kiểm tra CORS của Worker.";
    } finally {
        button.disabled = false;
    }
}
