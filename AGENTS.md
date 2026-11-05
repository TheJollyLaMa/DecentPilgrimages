# DecentPilgrimages

- Serve only `public/`: `node assistant/static-server.mjs`. Never expose repository-root or assistant/payroll configuration as static files.
- Validate locally: `node --test test/ui/*.test.mjs`, `node payroll/scripts/validatePayrollQueue.js`, `npm test` (local contract EVM).
- Keep historical `public/contracts/` and existing `public/abis/` untouched; only the V1 entrypoint is supported.
- Preserve exact Base V1 ABI/decimals, organizer authorization and confirmed receipt gates. GPS is optional, advisory and memory-only.
- No private data, API keys, wallet secrets or sensitive evidence in public files, fixtures, logs or exports. No live model/provider tests, deployments or payments.
- Payroll and assistant stay disabled unless a steward explicitly reviews and configures them. See [operations](docs/Operations.md) and [reuse provenance](docs/Reuse.md).
