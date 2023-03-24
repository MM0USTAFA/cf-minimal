"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const morgan_1 = __importDefault(require("morgan"));
const express_basic_auth_1 = __importDefault(require("express-basic-auth"));
const cheating_detector_1 = __importDefault(require("./cheating-detector"));
fs_1.default.exists('access.log', exists => {
    if (exists) {
        fs_1.default.unlinkSync('access.log');
    }
});
const logFile = fs_1.default.createWriteStream(path_1.default.join(__dirname, 'access.log'), {
    flags: 'a',
});
dotenv_1.default.config();
const app = express_1.default();
if (process.env.BASIC_AUTH_USERNAME) {
    app.use(express_basic_auth_1.default({
        users: { [process.env.BASIC_AUTH_USERNAME]: process.env.BASIC_AUTH_PASSWORD },
        challenge: true,
    }));
}
app.use(express_1.default.json());
app.use(cors_1.default());
app.use(morgan_1.default('dev', { stream: logFile }));
app.use(express_1.default.static(path_1.default.join(__dirname, './client')));
const codesMemo = new Map();
app.post('/api/cheating-detection', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    req.setTimeout(1000 * 60 * 5); // 5 Minutes
    const { groupId, contestId, blackList, matchingPercentageThreshold } = req.body;
    const parsedBlackList = blackList.split(',').map((str) => str.trim());
    const cheatingDetector = new cheating_detector_1.default(process.env.CF_HANDLE, process.env.CF_PASSWORD, groupId, contestId, parsedBlackList, matchingPercentageThreshold, codesMemo);
    const RETRIES = Number(process.env.RETRIES || 3);
    for (let i = 0; i < RETRIES; i += 1) {
        try {
            // eslint-disable-next-line no-await-in-loop
            const result = yield cheatingDetector.run();
            res.json(result);
            break;
        }
        catch (error) {
            console.log(`ATTEMPT [${i + 1}] FAILED.`);
            console.log(error);
        }
    }
}));
app.get('*', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, './client/index.html'));
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});
