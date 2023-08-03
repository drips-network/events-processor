# Drips Event Processor

:warning: **Warning**: This project is currently under active development.

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
