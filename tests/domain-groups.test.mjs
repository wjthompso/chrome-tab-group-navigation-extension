import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { clusterByDomain, domainInfoFromUrl, titleCaseDomain } from "../lib/domain-groups.js";

describe("titleCaseDomain", () => {
  test("keeps only the first label, in title case", () => {
    assert.equal(titleCaseDomain("google.com"), "Google");
    assert.equal(titleCaseDomain("github.com"), "Github");
    assert.equal(titleCaseDomain("my-cool-site.com"), "My-Cool-Site");
    assert.equal(titleCaseDomain("bbc.co.uk"), "Bbc");
    assert.equal(titleCaseDomain("notes.github.io"), "Notes");
    assert.equal(titleCaseDomain("localhost"), "Localhost");
    assert.equal(titleCaseDomain("192.168.0.1"), "192.168.0.1");
  });
});

describe("domainInfoFromUrl", () => {
  test("merges www and subdomains onto the registrable domain", () => {
    assert.deepEqual(domainInfoFromUrl("https://www.google.com/search?q=1"), {
      domain: "google.com",
      title: "Google",
    });
    assert.deepEqual(domainInfoFromUrl("https://mail.google.com/mail"), {
      domain: "google.com",
      title: "Google",
    });
    assert.deepEqual(domainInfoFromUrl("https://news.ycombinator.com/item?id=1"), {
      domain: "ycombinator.com",
      title: "Ycombinator",
    });
    assert.deepEqual(domainInfoFromUrl("https://example.co/"), {
      domain: "example.co",
      title: "Example",
    });
  });

  test("uses the organization label in front of a country suffix", () => {
    assert.deepEqual(
      domainInfoFromUrl("https://gitea.parquesnacionales.gov.co/priorizando-naturaleza/frontend"),
      { domain: "parquesnacionales.gov.co", title: "Parquesnacionales" },
    );
    assert.deepEqual(domainInfoFromUrl("https://www.parquesnacionales.gov.co/"), {
      domain: "parquesnacionales.gov.co",
      title: "Parquesnacionales",
    });
  });

  test("skips browser pages and empty urls", () => {
    assert.equal(domainInfoFromUrl("chrome://newtab/"), null);
    assert.equal(domainInfoFromUrl("chrome-extension://abc/popup.html"), null);
    assert.equal(domainInfoFromUrl(""), null);
    assert.equal(domainInfoFromUrl("not a url"), null);
  });
});

describe("clusterByDomain", () => {
  test("groups by domain in strip order and skips pinned and internal tabs", () => {
    const clusters = clusterByDomain([
      { id: 1, index: 0, pinned: true, url: "https://pin.example/a" },
      { id: 2, index: 3, url: "https://docs.google.com/a" },
      { id: 3, index: 1, url: "https://github.com/me" },
      { id: 4, index: 2, url: "https://www.google.com/" },
      { id: 5, index: 4, url: "chrome://extensions/" },
      { id: 6, index: 5, url: "https://github.com/other" },
    ]);

    assert.deepEqual(clusters, [
      { domain: "github.com", title: "Github", tabIds: [3, 6] },
      { domain: "google.com", title: "Google", tabIds: [4, 2] },
    ]);
  });
});
