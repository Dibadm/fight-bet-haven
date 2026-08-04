# Fight Winner Bets

Build a full-stack Telegram Mini App for a combat-sports prediction and wagering platform. This must be a real working application with a secure backend and database—not a frontend prototype or mockup.



Use Lovable’s full-stack capabilities with Supabase for authentication, PostgreSQL database, row-level security, storage, and server-side functions. Build the application in phases, but start by implementing the backend architecture and database correctly.



## Phase 1 — Core Betting Engine (Headless Backend First)



Do not build the final user interface until the core backend, database schema, wallet system, betting logic, and settlement flow are functional.



### 1. Events and Fight Cards



Create a data model for:



* Events

* Fight cards

* Fighters

* Weight classes

* Fight dates and start times

* Fight status:



  * Draft

  * Upcoming

  * Open for betting

  * Betting suspended

  * Live

  * Result pending

  * Settled

  * Cancelled

  * Postponed



Each fight must support:



* Fighter A

* Fighter B

* Weight class

* Scheduled rounds

* Event date and time

* Main-event flag

* Fight status

* Official result

* Result notes



### 2. Betting Markets



Support these markets:



#### Moneyline



* Fighter A wins

* Fighter B wins

* Draw, where applicable



#### Method of Victory



* KO/TKO

* Submission

* Decision

* Draw or no contest, where applicable



#### Round Markets



* Fight ends in Round 1

* Fight ends in Round 2

* Fight ends in Round 3

* Goes the distance



Design the database so additional market types can be added later without rebuilding the entire system.



### 3. Odds Engine



Admins must be able to:



* Create markets

* Add selections

* Set decimal odds

* Change odds at any time before betting closes

* Open a market

* Suspend a market

* Close a market

* Void a market



Important rules:



* When a user places a bet, save a permanent snapshot of the odds at the exact time of placement.

* Later odds changes must never change the odds of an existing bet.

* Suspended or closed markets must reject new bets.

* Prevent bets after the fight begins or after the market is closed.

* Validate all odds and stake values on the server, never only in the frontend.



### 4. Wallet and Ledger



Create a secure wallet system with:



* Available balance

* Funds currently held in open bets

* Total deposits

* Total withdrawals

* Transaction history



Use an immutable transaction ledger. Do not update balances without recording a transaction.



Transaction types should include:



* Deposit pending

* Deposit approved

* Deposit rejected

* Bet stake held

* Bet stake returned

* Bet winnings paid

* Withdrawal requested

* Withdrawal approved

* Withdrawal rejected

* Withdrawal paid

* Admin adjustment



When a bet is placed:



1. Validate the user’s available balance.

2. Hold or deduct the stake atomically.

3. Create the bet record.

4. Create the wallet ledger transaction.

5. Prevent duplicate submissions.



The entire operation must succeed or fail together. Do not allow negative balances.



### 5. Telebirr Deposit Flow



Implement a manual Telebirr deposit verification workflow.



User flow:



1. User enters the desired deposit amount.

2. The app displays the platform’s payment instructions.

3. The user sends money through Telebirr.

4. The user copies and submits the Telebirr SMS confirmation text.

5. The deposit is created with status `pending`.

6. An admin reviews the submitted SMS text and amount.

7. The admin approves or rejects the deposit.

8. Only an approved deposit credits the user wallet.



Store:



* User ID

* Submitted amount

* SMS confirmation text

* Submission time

* Deposit status

* Admin reviewer

* Review time

* Rejection reason, if rejected



Prevent duplicate SMS submissions where possible.



Do not automatically credit a wallet based only on text submitted by the user. Deposits must remain pending until approved unless a verified payment integration is added later.



### 6. Withdrawals



Implement:



* Withdrawal request

* User payment details

* Pending status

* Admin approval or rejection

* Paid status

* Withdrawal history



Rules:



* Users cannot withdraw funds that are locked in active bets.

* Users cannot withdraw more than their available balance.

* Withdrawal requests must be reviewed by an admin.

* Record every withdrawal action in the transaction ledger.

* Add configurable minimum and maximum withdrawal limits.



### 7. Bet Placement



Support single bets first.



Each bet must save:



* User ID

* Fight ID

* Market ID

* Selection ID

* Stake

* Odds snapshot

* Potential payout

* Bet status

* Placement timestamp



Bet statuses:



* Open

* Won

* Lost

* Void

* Cancelled

* Refunded



Calculate potential payout on the server:



`potential payout = stake × decimal odds`



Do not trust payout calculations sent from the frontend.



### 8. Settlement Engine



Admins must be able to enter the official fight result:



* Winner

* Method of victory

* Ending round

* Draw

* No contest

* Cancelled



After confirmation:



1. Resolve all affected open bets automatically.

2. Mark winning bets as `won`.

3. Mark losing bets as `lost`.

4. Credit winnings to winners.

5. Void or refund affected bets when required.

6. Create wallet ledger records for every payout or refund.

7. Update the fight status to `settled`.



Settlement must be:



* Server-side

* Atomic

* Idempotent



If the settlement action is clicked twice or retried, users must not receive duplicate payouts.



Add a settlement preview showing:



* Number of winning bets

* Number of losing bets

* Number of void/refunded bets

* Total payout

* Estimated platform profit or loss



Require an admin confirmation before final settlement.



### 9. House Revenue and Liability



Create calculations for:



* Total stakes per market

* Total potential payout

* Current liability by fighter/selection

* Estimated platform exposure

* Total deposits

* Total withdrawals

* Total payouts

* Gross betting revenue



Do not automatically deduct a “house cut” from a winning bet unless the commission model is explicitly configured. Use the odds and payout model as the primary settlement mechanism.



### 10. Security and Reliability



Implement:



* Supabase authentication

* Telegram Mini App authentication verification on the server

* Secure user identity mapping

* Role-based access:



  * User

  * Admin

  * Super admin

* Row-level security

* Server-side authorization checks

* Admin audit logs

* Input validation

* Rate limiting where appropriate

* Protection against duplicate requests

* No secret keys in frontend code

* No client-side wallet authority

* No client-side settlement authority



Create audit logs for:



* Odds changes

* Market status changes

* Deposit approvals and rejections

* Withdrawal decisions

* Fight-result changes

* Settlement actions

* Admin balance adjustments



## Phase 2 — Telegram Bot and Mini App Frontend



After Phase 1 is functional, build the Telegram Mini App and bot integration.



### User Features



* Browse upcoming fight cards

* View fighters and fight details

* Open a fight’s betting markets

* View current odds

* Add selections to a bet slip

* Enter stake

* See potential payout

* Place a bet

* View active bets

* View settled bet history

* View wallet balance

* Deposit through the Telebirr SMS submission flow

* Request withdrawals

* Receive Telegram notifications for:



  * Deposit approval

  * Deposit rejection

  * Withdrawal updates

  * Bet settlement

  * Winnings



### UI Requirements



Create a premium, modern, trustworthy combat-sports experience.



Visual direction:



* Dark premium interface

* Clean typography

* High-quality fight cards

* Subtle motion

* Floating card layouts

* Strong visual hierarchy

* Clear wallet balance

* Clear betting status

* Easy-to-read odds

* Professional financial UI patterns

* Responsive on mobile first

* Optimized for Telegram Mini App dimensions



Avoid:



* Fake statistics

* Fake balances

* Placeholder betting data in production flows

* Overly flashy animations

* Confusing casino visuals

* UI elements that make the platform look untrustworthy



The UI should feel premium and exciting while still looking like a serious financial product.



## Phase 3 — Admin Dashboard



Build a secure admin dashboard with:



### Event Management



* Create and edit events

* Create fights

* Add fighters

* Set dates and start times

* Update fight status

* Mark main events



### Market Management



* Create markets

* Add selections

* Set and change odds

* Open markets

* Suspend markets

* Close markets

* Void markets



### Financial Management



* Review pending Telebirr deposits

* View submitted SMS confirmation text

* Approve or reject deposits

* Review withdrawal requests

* Approve, reject, or mark withdrawals as paid

* View wallet transactions

* Make controlled admin adjustments with required reasons



### Result and Settlement



* Enter official fight results

* Preview settlement impact

* Confirm settlement

* View settlement logs

* Prevent duplicate settlement



### Live Risk Dashboard



Show:



* Total amount wagered

* Total stakes by fight

* Total stakes by selection

* Potential payout

* Current liability

* Exposure by fighter

* Exposure by market

* Open bets

* Pending deposits

* Pending withdrawals

* Recent transactions



## Technical Requirements



Use:



* React and TypeScript

* Supabase PostgreSQL

* Supabase Auth

* Supabase Row-Level Security

* Supabase Edge Functions or secure server-side functions

* Telegram Mini App integration

* Responsive mobile-first design



Create a clean, scalable architecture with:



* Database migrations

* Proper foreign keys

* Database constraints

* Server-side validation

* Reusable types

* Clear separation between frontend and business logic

* No critical business logic only in the browser



Before building the UI, first provide:



1. Proposed database schema

2. Tables a

nd relationships

3. Wallet ledger design

4. Bet lifecycle

5. Settlement flow

6. Security model

7. List of server-side functions

8. Any important risks or missing requirements



Then implement Phase 1 and test the core flows using seeded test data.



Use test/demo mode initially. Keep real-money operations disabled until the platform’s licensing, payment compliance, responsible-gaming requirements, and legal review are complete.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4e1eae42-381b-4059-8b55-8c20053325fc).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
