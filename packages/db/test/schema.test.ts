import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it } from "vitest";

const schema = readFileSync(new URL("../../../db/schema.sql", import.meta.url), "utf8");
const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const env = JSON.stringify({ v: 1, alg: "xchacha20poly1305", nonce: "00", ct: "11" });

let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await db.exec(schema);
  await db.exec(`INSERT INTO accounts(id) VALUES ('${A}'), ('${B}');
    INSERT INTO venues VALUES ('hall','Fictional Hall');
    INSERT INTO segments VALUES ('entrance-side','hall','entrance','Side');`);
});

const obsInsert = (id: string, extra = "") =>
  `INSERT INTO observations(id,segment_id,attribute,value_bool,source_kind,source_id,verifier_type,observed_at,retrieved_at,expires_at ${extra ? "," + extra.split("|")[0] : ""})
   VALUES ('${id}','entrance-side','stepFree',true,'venue_report','hall','venue_self_report','2026-10-01','2026-10-01','2027-01-01' ${extra ? "," + extra.split("|")[1] : ""})`;

describe("private items are ciphertext only and owner-scoped (RLS)", () => {
  it("has no plaintext profile columns", async () => {
    const cols = await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_name='private_items'`);
    expect(cols.rows.map((c) => c.column_name).sort()).toEqual(["account_id", "created_at", "envelope", "item_id", "version"]);
  });
  it("rejects envelopes that are not authenticated-encryption shaped", async () => {
    await expect(db.exec(`INSERT INTO private_items(account_id,item_id,version,envelope) VALUES ('${A}','profile',1,'{"plain":"avoidSteps"}')`)).rejects.toThrow();
  });
  it("RLS: one account cannot read or write another's items (as a non-superuser app role)", async () => {
    await db.exec(`CREATE ROLE app_user LOGIN; GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;`);
    await db.exec(`SET ROLE app_user; SET app.account_id = '${A}';`);
    await db.exec(`INSERT INTO private_items(account_id,item_id,version,envelope) VALUES ('${A}','profile',1,'${env}')`);
    await expect(db.exec(`INSERT INTO private_items(account_id,item_id,version,envelope) VALUES ('${B}','profile',1,'${env}')`)).rejects.toThrow();
    await db.exec(`SET app.account_id = '${B}'`);
    expect((await db.query(`SELECT * FROM private_items`)).rows).toHaveLength(0);
    await db.exec(`RESET app.account_id`);
    expect((await db.query(`SELECT * FROM private_items`)).rows).toHaveLength(0); // no account set => nothing visible
    await db.exec(`RESET ROLE`);
  });
});

describe("public observations are append-only", () => {
  it("accepts a valid observation; value/time/source columns cannot be edited; delete is blocked", async () => {
    await db.exec(obsInsert("o1"));
    await expect(db.exec(`UPDATE observations SET value_bool=false WHERE id='o1'`)).rejects.toThrow(/immutable/);
    await expect(db.exec(`UPDATE observations SET expires_at='2099-01-01' WHERE id='o1'`)).rejects.toThrow(/immutable/);
    await expect(db.exec(`UPDATE observations SET source_id='x' WHERE id='o1'`)).rejects.toThrow(/immutable/);
    await expect(db.exec(`DELETE FROM observations WHERE id='o1'`)).rejects.toThrow(/append-only/);
    await db.exec(`UPDATE observations SET status='withdrawn' WHERE id='o1'`); // allowed, and logged by the API
  });
  it("history cannot be rewritten or erased", async () => {
    await db.exec(obsInsert("o1"));
    await db.exec(`INSERT INTO observation_history(actor_role,actor_id,action,observation_id) VALUES ('partner','hall','add','o1')`);
    await expect(db.exec(`UPDATE observation_history SET actor_id='x'`)).rejects.toThrow(/append-only/);
    await expect(db.exec(`DELETE FROM observation_history`)).rejects.toThrow(/append-only/);
  });
  it("constraints: unlicensed feed, verified user report, bad times, ambiguous value all rejected", async () => {
    await expect(db.exec(`INSERT INTO observations(id,segment_id,attribute,value_bool,source_kind,source_id,verifier_type,observed_at,retrieved_at,expires_at)
      VALUES ('f1','entrance-side','stepFree',true,'operator_feed','f','operator','2026-10-01','2026-10-01','2027-01-01')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO observations(id,segment_id,attribute,value_bool,source_kind,source_id,verifier_type,observed_at,retrieved_at,expires_at)
      VALUES ('u1','entrance-side','stepFree',true,'user_report','community','paid_tester','2026-10-01','2026-10-01','2027-01-01')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO observations(id,segment_id,attribute,value_bool,source_kind,source_id,verifier_type,observed_at,retrieved_at,expires_at)
      VALUES ('t1','entrance-side','stepFree',true,'venue_report','hall','venue_self_report','2026-10-02','2026-10-01','2027-01-01')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO observations(id,segment_id,attribute,value_bool,value_num,source_kind,source_id,verifier_type,observed_at,retrieved_at,expires_at)
      VALUES ('v1','entrance-side','clearWidthMm',true,900,'venue_report','hall','venue_self_report','2026-10-01','2026-10-01','2027-01-01')`)).rejects.toThrow();
  });
  it("badges need scope, method, a real verifier type and a lapse date", async () => {
    await expect(db.exec(`INSERT INTO verification_badges(venue_id,scope,method,verifier_type,verified_at,valid_until) VALUES ('hall',' ','m','paid_tester','2026-01-01','2027-01-01')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO verification_badges(venue_id,scope,method,verifier_type,verified_at,valid_until) VALUES ('hall','s','m','none','2026-01-01','2027-01-01')`)).rejects.toThrow();
    await expect(db.exec(`INSERT INTO verification_badges(venue_id,scope,method,verifier_type,verified_at,valid_until) VALUES ('hall','s','m','paid_tester','2027-01-01','2026-01-01')`)).rejects.toThrow();
    await db.exec(`INSERT INTO verification_badges(venue_id,scope,method,verifier_type,verified_at,valid_until) VALUES ('hall','s','m','paid_tester','2026-01-01','2027-01-01')`);
  });
});
