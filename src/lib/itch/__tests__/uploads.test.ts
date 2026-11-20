import { test } from "node:test";
import assert from "node:assert/strict";
import { cdnExpiry, parseUploadList } from "../uploads";

// Rodar: node --experimental-strip-types --import ./src/lib/builds/__tests__/register.mjs --test src/lib/itch/__tests__/*.test.ts

// Trecho real da página de downloads do itch.io (Fantastic Chess, 20/11/2026), mais um .apk e um arquivo sem plataforma.
const HTML = `<div class="upload_list_widget"><div class="upload"><a href="javascript:void(0);" class="button download_btn" data-upload_id="20677440">Download</a><div class="info_column"><div class="upload_name"><strong class="name" title="FantasticChess-win64.zip">FantasticChess-win64.zip</strong> <span class="file_size"><span>837 MB</span></span> <span class="download_platforms"><span aria-hidden="true" title="Download for Windows" class="icon icon-windows8"></span> </span></div><div class="upload_date"><abbr title="20 November 2026 @ 02:54 UTC">19 hours ago</abbr></div></div></div><div class="upload"><a href="javascript:void(0);" class="button download_btn" data-upload_id="20677458">Download</a><div class="info_column"><div class="upload_name"><strong class="name" title="FantasticChess-linux.zip">FantasticChess-linux.zip</strong> <span class="file_size"><span>802 MB</span></span> <span class="download_platforms"><span aria-hidden="true" title="Download for Linux" class="icon icon-tux"></span> <span class="icon icon-apple"></span> </span></div></div></div><div class="upload"><a class="button download_btn" data-upload_id="3">Download</a><div class="info_column"><div class="upload_name"><strong class="name" title="jogo &amp; cia.apk">jogo &amp; cia.apk</strong> <span class="file_size"><span>20 MB</span></span></div></div></div><div class="upload"><a class="button download_btn" data-upload_id="4">Download</a><div class="info_column"><div class="upload_name"><strong class="name" title="OST.zip">OST.zip</strong></div></div></div></div>`;

test("lê a lista de arquivos da página de downloads", () => {
  const list = parseUploadList(HTML);
  assert.deepEqual(
    list.map((u) => [u.id, u.filename, u.sizeLabel, u.platforms]),
    [
      [20677440, "FantasticChess-win64.zip", "837 MB", ["windows"]],
      [20677458, "FantasticChess-linux.zip", "802 MB", ["macos", "linux"]],
      [3, "jogo & cia.apk", "20 MB", ["android"]],
      [4, "OST.zip", "", []],
    ],
  );
  // A página do jogo "pague quanto quiser" lista os nomes sem os ids: nada a ler ali.
  assert.deepEqual(parseUploadList(HTML.replace(/ data-upload_id="\d+"/g, "")), []);
});

test("validade do link do CDN", () => {
  assert.equal(cdnExpiry("https://dl.itch.zone/upload2/game/1/2?GoogleAccessId=x&Expires=1795219547&Signature=y")?.getTime(), 1795219547000);
  assert.equal(cdnExpiry("https://dl.itch.zone/x"), null);
});
