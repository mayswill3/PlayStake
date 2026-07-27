-- Older versions of prisma/seed.ts assigned the two demo PLAYER_BALANCE
-- accounts directly. Backfill an auditable source-of-funds transaction without
-- changing either player's available balance.
DO $$
DECLARE
    source_account_id UUID;
    source_balance DECIMAL(14,2);
    demo_account RECORD;
    funding_transaction_id UUID;
BEGIN
    SELECT id
    INTO source_account_id
    FROM ledger_accounts
    WHERE user_id IS NULL
      AND account_type = 'STRIPE_SOURCE'
    ORDER BY created_at ASC
    LIMIT 1;

    IF source_account_id IS NULL THEN
        source_account_id := gen_random_uuid();
        INSERT INTO ledger_accounts (
            id,
            account_type,
            balance,
            currency,
            frozen,
            created_at,
            updated_at
        )
        VALUES (
            source_account_id,
            'STRIPE_SOURCE',
            0,
            'USD',
            false,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );
    END IF;

    FOR demo_account IN
        SELECT
            la.id AS account_id,
            la.user_id,
            la.balance,
            u.email
        FROM ledger_accounts la
        JOIN users u ON u.id = la.user_id
        WHERE u.email IN (
            'player@test.playstake.com',
            'player2@test.playstake.com'
        )
          AND la.account_type = 'PLAYER_BALANCE'
          AND la.balance > 0
          AND NOT EXISTS (
              SELECT 1
              FROM ledger_entries le
              WHERE le.ledger_account_id = la.id
          )
    LOOP
        IF NOT EXISTS (
            SELECT 1
            FROM transactions t
            WHERE t.idempotency_key =
                'seed:initial-balance:' || demo_account.user_id::text
        ) THEN
            funding_transaction_id := gen_random_uuid();

            UPDATE ledger_accounts
            SET balance = balance - demo_account.balance,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = source_account_id
            RETURNING balance INTO source_balance;

            INSERT INTO transactions (
                id,
                idempotency_key,
                type,
                status,
                amount,
                currency,
                description,
                metadata,
                completed_at,
                created_at,
                updated_at
            )
            VALUES (
                funding_transaction_id,
                'seed:initial-balance:' || demo_account.user_id::text,
                'DEPOSIT',
                'COMPLETED',
                demo_account.balance,
                'USD',
                'Backfilled initial demo player balance',
                jsonb_build_object('source', 'legacy-seed-repair'),
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            );

            INSERT INTO ledger_entries (
                id,
                ledger_account_id,
                transaction_id,
                amount,
                balance_after,
                created_at
            )
            VALUES
                (
                    gen_random_uuid(),
                    source_account_id,
                    funding_transaction_id,
                    -demo_account.balance,
                    source_balance,
                    CURRENT_TIMESTAMP
                ),
                (
                    gen_random_uuid(),
                    demo_account.account_id,
                    funding_transaction_id,
                    demo_account.balance,
                    demo_account.balance,
                    CURRENT_TIMESTAMP
                );
        END IF;
    END LOOP;
END $$;
