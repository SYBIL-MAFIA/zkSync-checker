import axios from "axios";
import {ethers} from "ethers";

function getDayNumber(d) {
    return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    let yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    let weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return d.getUTCFullYear() + "W" + weekNo;
}

function getMonthNumber(d) {
    return d.getUTCFullYear() + "-" + (d.getUTCMonth() + 1);
}

const getEthPrice = async () => {
    try {
        const response = await axios.post('https://mainnet.era.zksync.io/', {
            id: 42,
            jsonrpc: '2.0',
            method: 'zks_getTokenPrice',
            params: ['0x0000000000000000000000000000000000000000'],
        });
        return response.data.result
    } catch (e) {
        console.log(e)
        return 1950
    }

}

function getZkSyncLastTX(lastTxDatetime) {
    const date = new Date(lastTxDatetime);
    const offset = 8;
    const utc8Date = new Date(date.getTime() + offset * 3600 * 1000);
    const now = new Date();
    const utc8Now = new Date(now.getTime() + offset * 3600 * 1000);
    const diff = utc8Now - utc8Date;
    const diffInHours = Math.floor(diff / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays > 0) {
        if (diffInDays > 7) {
            return `${parseInt(diffInDays / 7)} недель назад`
        }
        return `${diffInDays} дней назад`
    } else if (diffInHours > 0) {
        return `${diffInHours} часов назад`
    } else {
        return "только что"
    }
}

async function getAmount(address) {
    const ethPrice = await getEthPrice();
    var currentDate = new Date();
    var formattedDate = currentDate.toISOString();
    var encodedDate = encodeURIComponent(formattedDate);
    const initUrl = `https://block-explorer-api.mainnet.zksync.io/address/${address}/transfers?toDate=${encodedDate}&limit=100&page=1`;
    const response = await axios.get(initUrl)
    var pageValue = parseInt(response.data.meta.totalPages);
    let totalExchangeAmount = 0;
    for (let i = 1; i <= pageValue; i++) {
        const url = `https://block-explorer-api.mainnet.zksync.io/address/${address}/transfers?toDate=${encodedDate}&limit=100&page=${i}`;
        const response = await axios.get(url);
        const list = response.data.items;
        for (let i = 0; i < list.length; i++) {
            if (list[i]['token'] !== null && list[i]['type'] == "transfer") {
                if (list[i]['from'].toLowerCase() === address.toLowerCase() && list[i]['to'].toLowerCase() !== "0x0000000000000000000000000000000000008001".toLowerCase() 
                && list[i]['to'].toLowerCase() !== address.toLowerCase()) {
                    const symbol = list[i]['token']['symbol']
                    if (symbol === "ETH") {
                        totalExchangeAmount += (list[i]['amount'] / 10 ** 18) * parseFloat(ethPrice)
                    } 
                    else if (list[i]['token']['symbol'] === "USDC") {
                        totalExchangeAmount += list[i]['amount'] / 10 ** 6
                    }
                    // else if (list[i]['token']['symbol'] === "USD+") {
                    //     totalExchangeAmount += list[i]['amount'] / 10 ** 6
                    // }
                }
            }
        }
    }
    return totalExchangeAmount;
}

async function processTransactions(
    zks2_last_tx,
    totalExchangeAmount,
    address,
    totalFee,
    contract,
    days,
    weeks,
    months,
    list,
    l1Tol2Times,
    l1Tol2Amount,
    l2Tol1Times,
    l2Tol1Amount
    ) {
    for (let i = 0; i < list.length; i++) {
        if (list[i]['from'].toLowerCase() === address.toLowerCase()) {
            const receivedAt = new Date(Date.parse(list[i]['receivedAt']));
            if (zks2_last_tx === null) {
                zks2_last_tx = getZkSyncLastTX(list[i]['receivedAt']);
                console.log(zks2_last_tx)
            }
            const contractAddress = list[i]['to'];
            const fee = (parseInt(list[i]['fee'], 16) / 10 ** 18).toFixed(5)
            totalFee += parseFloat(fee);
            contract.add(contractAddress)
            days.add(getDayNumber(receivedAt));
            weeks.add(getWeekNumber(receivedAt));
            months.add(getMonthNumber(receivedAt));
        }
        if (list[i].isL1Originated === true) {
            l1Tol2Times++;
            const value = ethers.formatEther(list[i]['value'], "ether");
            l1Tol2Amount += parseFloat(value);
        } else if (
            list[i]['to'] ===
            "0x000000000000000000000000000000000000800A"
            ) {
            l2Tol1Times++;
            const value = ethers.formatEther(list[i]['value'], "ether");
            l2Tol1Amount += parseFloat(value);
        }
    }
    return [zks2_last_tx, totalExchangeAmount, totalFee, contract, days, weeks, months, l1Tol2Times, l1Tol2Amount,
            l2Tol1Times,
            l2Tol1Amount];
}

async function getZkSyncBridge(address) {
    try {
        let zks2_last_tx = null;
        let contract = new Set();
        let days = new Set();
        let weeks = new Set();
        let months = new Set();
        let dayActivity;
        let weekActivity;
        let monthActivity;
        let contractActivity;
        let totalFee = 0;
        let l1Tol2Times = 0;
        let l1Tol2Amount = 0;
        let l2Tol1Times = 0;
        let l2Tol1Amount = 0;
        let totalExchangeAmount = 0;
        const initUrl = `https://block-explorer-api.mainnet.zksync.io/transactions?address=${address}&limit=100&page=1`;
        const response = await axios.get(initUrl)
        const pageValue = parseInt(response.data.meta.totalPages);
        for (let i = 1; i <= pageValue; i++) {
            const url = `https://block-explorer-api.mainnet.zksync.io/transactions?address=${address}&limit=100&page=${i}`;
            const response = await axios.get(url);
            const list = response.data.items;

            [zks2_last_tx,
             totalExchangeAmount, totalFee, contract, days, weeks, months, l1Tol2Times, l1Tol2Amount,
             l2Tol1Times, l2Tol1Amount] =
                await processTransactions(
                    zks2_last_tx,
                    totalExchangeAmount,
                    address,
                    totalFee,
                    contract,
                    days,
                    weeks,
                    months,
                    list,
                    l1Tol2Times,
                    l1Tol2Amount,
                    l2Tol1Times,
                    l2Tol1Amount
                    )
        }
        totalExchangeAmount = await getAmount(address);
        dayActivity = days.size;
        weekActivity = weeks.size;
        monthActivity = months.size;
        contractActivity = contract.size;
        // console.log("zks2_last_tx", zks2_last_tx);
        return {
            zks2_last_tx: zks2_last_tx === null ? "No transaction" : zks2_last_tx,
            totalExchangeAmount: totalExchangeAmount.toFixed(2),
            totalFee: totalFee.toFixed(4),
            contractActivity,
            dayActivity,
            weekActivity,
            monthActivity,
            l1Tol2Times,
            l1Tol2Amount: l1Tol2Amount.toFixed(3),
            l2Tol1Times,
            l2Tol1Amount: l2Tol1Amount.toFixed(3)
        }
    } catch (e) {
        console.log(e);
        return {
            zks2_last_tx: "Error",
            totalExchangeAmount: "Error",
            totalFee: "Error",
            contractActivity: "Error",
            dayActivity: "Error", weekActivity: "Error", monthActivity: "Error",
            l1Tol2Times: "Error", l1Tol2Amount: "Error", l2Tol1Times: "Error", l2Tol1Amount: "Error"
        }
    }
}

export default getZkSyncBridge;