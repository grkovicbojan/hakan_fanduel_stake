# Vendored `shared_auth`

A copy of `shared_auth/node/index.js` from the `social_dataset` repository —
the hub that issues the identity tokens every service on the domain trusts.

Copied rather than imported from the sibling checkout. This file used to be
loaded as:

    import { ... } from "/mnt/social_dataset/shared_auth/node/index.js";

which is a deployment that breaks the first time the two projects are not on
the same disk — a different server, a container, or anyone cloning this repo to
work on it. The same reasoning is written up in the other services' `vendor/`
directories for `mlclient`.

**Re-copy it when the hub's token format changes.** `npm test` checks that this
copy still verifies a token the hub would mint, so a drift shows up as a
failing test rather than as sign-ins breaking in production.
