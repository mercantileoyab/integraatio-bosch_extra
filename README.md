# Integration with Bosch EXTRA

This project integrates with Bosch EXTRA to handle specific operations. It supports both development and production environments and includes an option to handle failed sent turnovers.

Example command for testing:

node index.js dev

& for production use:

node index.js prod

All sent turnovers are saved to /tmp/turnovers.csv -file.

All failed sent turnovers are saved to /tmp/failed_turnovers.json -file.
For sending failed turnovers use command (example): node index.js prod handlefailed (dublicates are handled inside functions).


## Commands

To run the project, use the following command:

```bash
node index.js <environment> [extra_arguments]
