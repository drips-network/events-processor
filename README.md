# Drips Event Processor

:warning: **Warning**: This project is currently under active development.

Drips Event Processor is a custom, read-only backend service for [Drips](https://drips.network). It ingests low-level Drips protocol Ethereum events and related IPFS documents in real-time, and produces a database of higher-level entities for the Drips App (such as "Drip Lists" and "Projects"). This database is then read by the [Drips GraphQL API](https://github.com/drips-network/graphql-api) in order to provide a single, convenient and fast endpoint for querying decentralized data within the Drips Network without complicated client-side logic.

As a "read-only" service, Drips Event Processor and Drips GraphQL API together merely act as a query API layer for on-chain activity, meaning that Ethereum and IPFS remain the source of truth for all activity on Drips. In practice, this means that anyone is able to run an instance of this service and reach the exact same state as Drips' production instance once all past events have been ingested.

<br />

![Overview Diagram of Drips architecture](https://github.com/drips-network/drips-events-processor/blob/a512672c503d6aeaa1d106a5271bb913456f503b/docs/assets/drips-event-processor-diagram.png?raw=true)

<br />

Drips Event Processor & GraphQL API together are comparable in functionality and scope to the [Drips Subgraph](https://github.com/drips-network/subgraph), but add the flexibility of computing and exposing higher-level abstracted entities (such as `Projects` and `Drip Lists`). The canonical state of these entities is derived from low-level generics within the [Drips Protocol](https://github.com/drips-network/contracts), in combination with metadata stored on IPFS.

## 🏃‍♂️ Running The Development Environment

Run:

```bash
docker-compose up
```

This will spin up:

1. **Postgres**: the database for the application.

2. **pgAdmin**: the GUI for managing the PostgreSQL database.

3. **Redis**: the database for storing (bee)queue jobs.

_To monitor`BeeQueue` navigate to `http://localhost:3000/arena` after launching the app._

Docker is configured to preserve the state of the database and Redis in-between runs. If you want to start fresh, you'll need to delete the respective volumes with Docker.

## 🔌 Connecting to pgAdmin

After you have ensured that the Docker containers are up and running, to connect to pgAdmin:

1. Open your browser and go to <http://localhost:5050/>.
2. Check out the `docker-compose.yml` file for the `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` values. Use these to log into pgAdmin.
3. Check out the `servers.json` file for the `Name` and `Password` values. Use the `Password` value to connect to the `Name` Postgres server, if prompted.

## 🚀 Launching The Application

First, populate `.env` according to `.env.template`.

To launch the application, run:

```bash
npm install
```

Then, ensure you run the development environment, assuming you don't intend to connect to external Postgres and Redis instances.

Lastly, run

```bash
npm run start:dev
```

to start the server.

This command:

1. Establishes a connection to `dripsdb`.
2. Synchronizes the state of the database.
3. Ingests events up to the current block into the database.
4. Registers event listeners for tracking incoming events.
5. Continues appending new data to the database.
