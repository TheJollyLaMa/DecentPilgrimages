const test = require("node:test");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { createHash } = require("node:crypto");

const wallet = `0x${"1".repeat(40)}`, verifier = `0x${"2".repeat(40)}`;
async function fixture(t, options = {}) {
    const { createStaticServer } = await import("../../assistant/static-server.mjs");
    const server = createStaticServer();
    await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());
    const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce",
        permissions: ["geolocation"], geolocation: { latitude: 43, longitude: -76, accuracy: 5 }, ...options });
    const base = `http://127.0.0.1:${server.address().port}`, requests = [], errors = [];
    await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin === base) return route.continue();
        requests.push(url.href);
        return route.abort();
    });
    const page = await context.newPage();
    await page.clock.install({ time: new Date() });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.locator("#map .marker").first().waitFor();
    return { page, context, requests, errors };
}

for (const width of [1024, 390]) {
    test(`real geographic map and basket draft at ${width}px: consent, coordinates, GPS, exact metadata, no fake verification`, async t => {
        const { page, context, requests, errors } = await fixture(t, { viewport: { width, height: 844 } });
        assert.equal(await page.locator("#map .marker").count(), 3);
        assert.equal(await page.locator("#map path.leaflet-interactive").count(), 3);
        assert.deepEqual(requests, []);
        await page.locator("#trail-list button").nth(1).click();
        assert.match(await page.locator("#detail-title").innerText(), /museum/);
        await page.locator("#map").click({ position: { x: 120, y: 180 } });
        assert.match(await page.locator('#pin-form [name="latitude"]').inputValue(), /^-?\d+\.\d{6}$/);
        const form = page.locator("#pin-form");
        for (const [name, value] of Object.entries({
            name: "A purposeful museum visit", description: "See the new exhibit and tell your host what you learned.",
            latitude: "43.000000", longitude: "-76.000000", radius: "30", prompt: "Describe one object you noticed.",
            participants: `${wallet}, ${verifier}`, verifier, amount: "0.001",
            expiresAt: new Date(Date.now() + 86400000).toISOString().slice(0, 16)
        })) await form.locator(`[name="${name}"]`).fill(value);
        await form.locator('[name="consent"]').check();
        await form.getByRole("button", { name: "Review gate & required funding" }).click();
        await page.waitForFunction(() => !document.getElementById("export-gate").disabled);
        assert.match(await page.locator("#gate-review").innerText(), /2000000000000000 raw ETH/);
        const downloadPromise = page.waitForEvent("download");
        await page.locator("#export-gate").click();
        const stream = await (await downloadPromise).createReadStream();
        const buffers = [];
        for await (const chunk of stream) buffers.push(chunk);
        const bytes = Buffer.concat(buffers), metadata = JSON.parse(bytes.toString());
        const digest = createHash("sha256").update(bytes).digest("hex");
        assert.match(await page.locator("#gate-review").innerText(), new RegExp(digest));
        assert.equal(metadata.status, "unfunded-draft");
        assert.equal(metadata.mode, "per-participant");
        await page.locator("#import-gate").setInputFiles({ name: "recovered.json", mimeType: "application/json", buffer: bytes });
        await page.waitForFunction(() => /Draft recovered/.test(document.getElementById("pin-status").textContent));
        assert.equal(await page.locator("#export-gate").isEnabled(), false);
        assert.equal(await form.locator('[name="consent"]').isChecked(), false);
        await form.locator('[name="consent"]').check();
        await form.getByRole("button", { name: "Review gate & required funding" }).click();
        await page.waitForFunction(() => !document.getElementById("export-gate").disabled);
        assert.equal(await page.locator("#visit-video").isEnabled(), false);
        await page.locator("#request-location").click();
        await page.waitForFunction(() => !document.getElementById("visit-video").disabled);
        await page.locator("#visit-video").click();
        assert.match(await page.locator("#visit-result").innerText(), /not connected.*No camera/);
        await form.locator('[name="mode"]').selectOption("first-collector");
        await form.locator('[name="verification"]').selectOption("knowledge");
        assert.equal(await page.locator("#export-gate").isEnabled(), false, "editing invalidates the previously hashed metadata");
        await form.getByRole("button", { name: "Review gate & required funding" }).click();
        await page.waitForFunction(() => !document.getElementById("export-gate").disabled);
        assert.match(await page.locator("#gate-review").innerText(), /1000000000000000 raw ETH/);
        await page.locator("#visit-knowledge").click();
        assert.match(await page.locator("#visit-result").innerText(), /not connected.*server-side/);
        await page.clock.fastForward(60001);
        assert.equal(await page.locator("#visit-knowledge").isEnabled(), false);
        assert.match(await page.locator("#arrival-state").innerText(), /fresh location/);
        await page.clock.setSystemTime(new Date());
        await context.setGeolocation({ latitude: 44, longitude: -76, accuracy: 5 });
        await page.locator("#request-location").click();
        await page.waitForFunction(() => /Outside/.test(document.getElementById("arrival-state").textContent));
        assert.equal(await page.locator("#visit-knowledge").isEnabled(), false);
        await page.locator("#clear-location").click();
        assert.match(await page.locator("#arrival-state").innerText(), /fresh location/);
        await page.locator("#import-gate").setInputFiles({ name: "private.json", mimeType: "application/json",
            buffer: Buffer.from(JSON.stringify({ ...metadata, privateAnswer: "must never be recovered" })) });
        await page.waitForFunction(() => /recovery refused/.test(document.getElementById("pin-status").textContent));
        assert.equal(await page.locator("#export-gate").isEnabled(), false);
        assert.equal(await page.locator("#visit-knowledge").isEnabled(), false);
        assert.deepEqual(requests, []);
        await page.locator("#map-tiles").check();
        await page.waitForFunction(() => /unavailable/.test(document.getElementById("map-status").textContent));
        assert.ok(requests.length > 0);
        assert.ok(requests.every(url => new URL(url).hostname === "tile.openstreetmap.org"));
        await page.locator("#map-tiles").uncheck();
        assert.match(await page.locator("#map-status").innerText(), /no new tile requests/);
        const dimensions = await page.evaluate(() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(dimensions.scroll <= dimensions.client, JSON.stringify(dimensions));
        assert.deepEqual(errors, []);
    });
}

test("map tutorial and About remain usable; denied GPS never enables a visit", async t => {
    const { page, context, errors } = await fixture(t);
    await context.clearPermissions();
    await context.grantPermissions([]);
    await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_success, error) => error({ code: 1 }); });
    await page.reload();
    await page.locator("#map .marker").first().waitFor();
    await page.locator("#request-location").click();
    await page.waitForFunction(() => /denied/.test(document.getElementById("geo-status").textContent));
    assert.equal(await page.locator("#visit-video").isEnabled(), false);
    await page.locator("decent-header app-title button").click();
    await page.locator("#about-tour").click();
    for (let i = 0; i < 6; i++) {
        assert.equal(await page.locator("#tour-progress").innerText(), `HOP ${i + 1} OF 6`);
        await page.locator("#tour-next").click();
    }
    assert.equal(await page.locator("#tour-dialog").isVisible(), false);
    assert.deepEqual(errors, []);
});
