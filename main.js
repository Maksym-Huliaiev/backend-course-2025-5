const { Command } = require("commander");
const fs = require("fs");
const http = require("http");
const { URL } = require("url");
const path = require("path");

const program = new Command();

program
    .requiredOption("-h, --host <host>", "адреса сервера")
    .requiredOption("-p, --port <port>", "порт сервера")
    .requiredOption("-c, --cache <path>", "шлях до директорії для кешування");

program.parse(process.argv);
const opts = program.opts();

console.log(opts);

if (!fs.existsSync(opts.cache)) {
    fs.mkdirSync(opts.cache);
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        console.log(`Received request: ${req.method} ${url.pathname}`);

        const code = (url.pathname || "/").replace("/", "").trim();
        console.log(`Requested code: ${code}`);

        if (!code) {
            res.writeHead(400, { "Content-Type": "text/plain" });
            return res.end("Bad Request: expected path like /200");
        }

        const filePath = path.resolve(opts.cache, `${code}.jpg`);
        console.log(`path: ${filePath}`);

        if (req.method === "GET") {
            try {
                const data = await fs.promises.readFile(filePath);
                res.writeHead(200, { "Content-Type": "image/jpeg" });
                return res.end(data);
            } catch (err) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                return res.end("Not Found");
            }
        } else if (req.method === "PUT") {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = Buffer.concat(chunks);

            if (!body.length) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                return res.end("Bad Request: empty body");
            }

            await fs.promises.writeFile(filePath, body);
            res.writeHead(201, { "Content-Type": "text/plain" });
            return res.end("Created");
        } else if (req.method === "DELETE") {
            try {
                await fs.promises.unlink(filePath);
                res.writeHead(200, { "Content-Type": "text/plain" });
                return res.end("OK");
            } catch (err) {
                res.writeHead(404, { "Content-Type": "text/plain" });
                return res.end("Not Found");
            }
        } else {
            res.writeHead(405, { "Content-Type": "text/plain" });
            return res.end("Method Not Allowed");
        }

    } catch (err) {
        console.error(err);
        res.writeHead(500, { "Content-Type": "text/plain" });
        return res.end("Internal Server Error");
    }
});

server.listen(opts.port, opts.host, () => {
    console.log(`Server running at http://${opts.host}:${opts.port}`);
});