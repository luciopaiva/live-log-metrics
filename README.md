
# Live log metrics

Parses metrics logs in real time, showing them in a simple web page.

## Setup

    nvm install
    npm install

## Running

    node llm <web_server_port> <json_file>

Example usage:

    node llm 8000 production.json

## Sample JSON file

    [
      {
        "alias": "node1",
        "host": "my-server-1",
        "command": "sudo tailf /var/log/server/server.log"
      },
      {
        "alias": "node2",
        "host": "my-server-2",
        "command": "sudo tailf /var/log/server/server.log"
      },
      {
        "alias": "node3",
        "host": "my-server-3",
        "command": "sudo tailf /var/log/server/server.log"
      }
    ]

Where `my-server-1`, `my-server-2` and `my-server-3` are hosts configured in your `~/.ssh/config`.
