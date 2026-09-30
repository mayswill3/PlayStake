-- Ledger entries are the permanent record of every money movement. transfer()
-- only ever inserts them; a correction is a new, reversing transfer. Reject
-- any UPDATE or DELETE so a bug or a stray query can't rewrite history.
CREATE OR REPLACE FUNCTION reject_ledger_entry_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger entries are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ledger_entries_immutable"
BEFORE UPDATE OR DELETE ON "ledger_entries"
FOR EACH ROW EXECUTE FUNCTION reject_ledger_entry_mutation();
