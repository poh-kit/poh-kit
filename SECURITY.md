# Security Policy

## Reporting

Email **dagan.eliahou.gilat@gmail.com** with a description and reproduction
steps. You'll get an acknowledgement within 72 hours. Please don't open public
issues for unpatched vulnerabilities.

## Scope

The packages and contracts in this repository. The hosted Foundation service
has its own operational security process and is out of scope here.

## Known design notes

- `createSelfVerifier({ devMode: true })` accepts mock passports from the Self
  dev environment. Never enable it in production; the kit defaults it to false.
- Semaphore signal verification is replay-protected per scope via
  `UsedSignalStore` — hosts must back it with durable storage in production.
