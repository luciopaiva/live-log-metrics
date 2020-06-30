// ToDo refactor into class
// ToDo filter out fields like "extracted" and "computed"

const
    fs = require("fs"),
    http = require("http"),
    spawn = require("child_process").spawn,
    readline = require("readline");

const metrics = {};
const sseClients = new Set();

let server;
let eventId = 1;
let logLines = 0;
let metricsLines = 0;
let nextTimeShouldReportMetrics = 0;
let numberOfHosts = 0;

function sendFile(fileName, contentType, request, response) {
    response.writeHead(200, { "Content-Type": contentType });
    response.write(fs.readFileSync(fileName, "utf-8"));  // tempting to cache, but we need it fresh
    response.end();
}

function sendHtml(fileName, request, response) {
    sendFile(fileName, "text/html", request, response);
}

function sendMetricsToClient(response) {
    try {
        const data = JSON.stringify(metrics);
        response.write(`id: ${eventId++}\nevent: metrics\ndata: ${data}\n\n`)
    } catch (error) {
        console.error(error);
    }
}

function sendMetricsToAll() {
    for (const response of sseClients.values()) {
        sendMetricsToClient(response);
    }
}

function handleNewSseClient(request, response) {
    console.info("Got new SSE client");

    const obj = {
        a: 1,
        b: 2,
    }

    response.writeHead(200, {
        "Connection": "keep-alive",
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
    });

    request.on("close", () => {
        response.end();
        sseClients.delete(response);
    });

    sseClients.add(response);
    sendMetricsToClient(response);
}

function startWebServer(port) {
    function handleRequest(request, response) {
        if (request.url === "/") {
            sendHtml("index.html", request, response);
        } else if (request.url === "/metrics") {
            handleNewSseClient(request, response);
        }
    }

    console.info("Starting web server...");
    server = http.createServer(handleRequest);
    server.listen(port);
}

function reportOwnMetrics() {
    if (Date.now() > nextTimeShouldReportMetrics) {
        console.info(`total_lines=${logLines}, metrics_lines=${metricsLines}`)
        logLines = 0;
        metricsLines = 0;
        nextTimeShouldReportMetrics = Date.now() + 1000;
    }
}

function startMetricsCapture(index, host, command) {
    console.info(`Connecting to ${host} [${index}]...`);

    const tailf = spawn("ssh", [host, command]);
    const rl = readline.createInterface({ input: tailf.stdout });

    tailf.on("exit", code => console.info("exit code: " + code));

    const metricRegex = /([^\s=]+?)=(\S+)/g;

    rl.on("line", line => {
        let hadMetricsUpdate = false;

        let match;
        while (match = metricRegex.exec(line)) {
            const metricName = match[1];
            const metricValue = match[2];
            if (!Array.isArray(metrics[metricName])) {
                metrics[metricName] = Array(numberOfHosts).fill("-");
            }
            metrics[metricName][index] = metricValue;
            hadMetricsUpdate = true;
        }

        if (hadMetricsUpdate) {
            sendMetricsToAll();
            metricsLines++;
        }
        logLines++;
    });
}

function processConfigFile(fileName) {
    return JSON.parse(fs.readFileSync(fileName, "utf-8"));
}

function main(args) {
    startWebServer(parseInt(args[0]));
    const hosts = processConfigFile(args[1]);
    numberOfHosts = hosts.length;

    metrics["alias"] = hosts.map(host => host["alias"]);

    for (let i = 0; i < numberOfHosts; i++) {
        const host = hosts[i];
        startMetricsCapture(i, host["host"], host["command"]);
    }

    setInterval(reportOwnMetrics, 1000);
}

const args = process.argv.slice(2);
if (args.length < 2) {
    console.info("Too few arguments.");
    process.exit(1);
} else {
    main(args);
}
