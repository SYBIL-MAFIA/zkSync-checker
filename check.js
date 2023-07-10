import fs from 'fs';
import exceljs from 'exceljs';
import getTxCount from "./modules/getTxcount.js";
import getEthBalance from "./modules/getEthBalance.js";
import getZkSyncBridge from './modules/zkSyncBridge.js';
import getZksLite from "./modules/getZksLite.js";
import getZksEra from "./modules/getZksEra.js";

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function apiRequest(request, retries = 5, delay = 100000) {
    for (let i = 0; i < retries; i++) {
        try {
            return await request();
        } catch (error) {
            if (error.response && error.response.status === 429) {
                console.log('Too Many Requests: Retrying after delay...');
                await delay(delay);
            } else {
                throw error;
            }
        }
    }
    throw new Error('API Request Failed after retries');
}

async function processData(addresses) {
    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet('Data');

    // Заголовки столбцов
    worksheet.getRow(1).values = [
        'Адресс',
        'Баланс ETH',
        'Кол-во транзакций общее',
        'Последняя транзакция',
        'Обьем',
        'Комиссия',
        'Сколько контрактов',
        'Месячная активность',
        'L1-L2',
        'L2-L1',
        'Кол-во транзакций Lite',
        'Кол-во транзакций Era',
    ];

    for (let i = 0; i < addresses.length; i++) {
        const address = addresses[i];
        const network = 'arbitrum';
        const getEthBal = await apiRequest(() => getEthBalance(address, network));
        const getTxcount = await apiRequest(() => getTxCount(address, network));
        const zkSyncBridgeData = await apiRequest(() => getZkSyncBridge(address));
        const getZkLite = await apiRequest(() => getZksLite(address));
        const getZkEra = await apiRequest(() => getZksEra(address));

        const rowData = [
            address,
            getEthBal,
            getTxcount,
            zkSyncBridgeData.zks2_last_tx,
            zkSyncBridgeData.totalExchangeAmount,
            zkSyncBridgeData.totalFee,
            zkSyncBridgeData.contractActivity,
            zkSyncBridgeData.monthActivity,
            zkSyncBridgeData.l1Tol2Amount,
            zkSyncBridgeData.l2Tol1Amount,
            getZkLite.tx1,
            getZkEra.tx2,
        ];

        // Запись данных в строку таблицы
        worksheet.addRow(rowData);

        await delay(10000); // Задержка 1 секунду между запросами
    }

    const excelFile = 'data.xlsx'; // Имя файла Excel
    await workbook.xlsx.writeFile(excelFile);
    console.log(`Данные успешно записаны в файл ${excelFile}`);
}

async function main() {
    const addressFile = 'wallet.txt'; // Путь к файлу .txt с адресами

    try {
        const addresses = fs.readFileSync(addressFile, 'utf-8').split('\n').map(address => address.trim());

        await processData(addresses);
    } catch (error) {
        console.error(error);
    }
}

main();
