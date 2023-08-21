# Drips Event Processor

:warning: **Warning**: This project is currently under active development.

Drips Event Processor is a custom, read-only backend service for [Drips](https://drips.network). It ingests Ethereum events in real-time, stores them in a database, and exposes data in form of a GraphQL API. As a "read-only" service, it merely acts as a query API layer for on-chain activity, meaning that Ethereum and IPFS remain the source of truth for all activity on Drips. In practice, this means that anyone will be able to run an instance of this service and reach the exact same state as Drips' production instance once all past events have been ingested.

<br />

![Overview Diagram of Drips architecture](https://github.com/drips-network/drips-events-processor/blob/a512672c503d6aeaa1d106a5271bb913456f503b/docs/assets/drips-event-processor-diagram.png?raw=true)

<br />

Drips Event Processor is comparable in functionality and scope to the [Drips Subgraph](https://github.com/drips-network/subgraph), but adds the flexibility of computing and exposing higher-level abstracted entities (such as `Projects` and `Drip Lists`), the state of which is derived from low-level generics within the [Drips Protocol](https://github.com/drips-network/contracts), in combination with metadata stored on IPFS. Additionally, we'll be able to produce real-time balance estimates for accounts at time-of-query. Combined, these capabilities will allow us to greatly enhance the speed and reliability of the [Drips App](https://github.com/drips-network/app), which currently needs to fetch an excessive amount of low-level information in order to derive the current state and balances of Drips Accounts, Projects and Drip Lists client-side.

## 🏃‍♂️ Running The Database (Containers)

Run:

```bash
docker-compose up
```

This will spin up:

1. **Postgres**: the (PostgreSQL) database for the application.

2. **pgAdmin**: the GUI for managing the PostgreSQL database.

## 🔌 Connecting to pgAdmin

After you have ensured that the Docker containers are up and running, to connect to pgAdmin:

1. Open your browser and go to <http://localhost:5050/>.
2. Check out the `docker-compose.yml` file for the `PGADMIN_DEFAULT_EMAIL` and `PGADMIN_DEFAULT_PASSWORD` values. Use these to log into pgAdmin.

📝 _Note_: If you're running the pgAdmin container for the first time, you'll need to create a new Server. A Server is a PostgreSQL server you want to connect to.

To set up a new Server:

1. In the left-hand Browser pane, right-click on 'Servers' and choose 'Register' > 'Server...'.
2. A dialog box will pop up. Fill in the 'Name' field under the 'General' tab with a server name (e.g., Drips).
3. Open the .env file to get the `POSTGRES_USER` and `POSTGRES_PASSWORD`.
4. Click on the 'Connection' tab, and input the following details:
   - **Hostname/address**: Enter `postgres` if PostgreSQL is running on your local machine.
   - **Port** This is typically `5432` by default. It should correspond with what's outlined in the `docker-compose.yml` file.
   - **Maintenance database**: Usually, this is `postgres` for a standard PostgreSQL setup.
   - **Username**: Use the `POSTGRES_USER` from the `.env` file.
   - **Password**: Input the `POSTGRES_PASSWORD` from the `.env` file.

## 🚀 Launching The Application

To launch the application, run:

```bash
npm run start:dev
```

This command:

1. Checks for the existence of `dripsdb`; creates it if not present.
2. Establishes a connection to `dripsdb`.
3. Synchronizes the state of the database.
4. Ingests events up to the current block into the database.
5. Registers event listeners for tracking incoming events.
6. Continues appending new data to the database.
