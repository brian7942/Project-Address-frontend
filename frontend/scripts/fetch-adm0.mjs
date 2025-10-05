// 교체본: fetchJSONAny
async function fetchJSONAny(urls, { timeout, retries }) {
  let lastErr = null;

  urlsLoop:
  for (const url of urls) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        process.stdout.write(`GET ${url} ... `);
        const r = await fetchWithTimeout(url, timeout);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);

        const text = await r.text();

        // ⛳️ LFS 포인터면 같은 URL 재시도하지 말고 '다음 URL'로
        if (isLFSPointer(text)) {
          console.log("LFS pointer; trying next source");
          continue urlsLoop; // ✅ 다음 URL로
        }

        const t = text.trim();
        if (t.startsWith("{") || t.startsWith("[")) {
          const json = JSON.parse(t);
          console.log("ok");
          return json;
        }

        console.log("not JSON; trying next");
        // JSON 아니면 이 URL은 건너뛰고 다음 URL
        continue urlsLoop;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          const delay = Math.min(1000 * 2 ** (attempt - 1), 8000);
          console.log(`failed (${e?.message ?? e}); retry in ${delay}ms`);
          await new Promise((res) => setTimeout(res, delay));
        } else {
          console.log(`failed (${e?.message ?? e})`);
          // 이 URL은 포기하고 다음 URL로
          break;
        }
      }
    }
  }

  throw lastErr ?? new Error("All sources failed");
}
