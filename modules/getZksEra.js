import axios from 'axios';

async function getZksEra(address) {
    try {
        let url = "https://block-explorer-api.mainnet.zksync.io/address/" + address;
        const response = await axios.get(url);
        let tx2, balance2, usdcBalance;
        if ("0x000000000000000000000000000000000000800A" in response.data.balances) {
            balance2 = (response.data.balances["0x000000000000000000000000000000000000800A"]
                .balance / 10 ** 18).toFixed(4)
        } else {
            balance2 = 0;
        }
        if ("0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4" in response.data.balances) {
            usdcBalance = (response.data.balances["0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4"]
                .balance / 10 ** 6).toFixed(2)
        } else {
            usdcBalance = 0;
        }
        tx2 = response.data.sealedNonce;
        return {balance2, tx2, usdcBalance};
    } catch (error) {
        console.error(error);
        return {balance2: "Error", tx2: "Error", usdcBalance: "Error"};
    }
}

export default getZksEra;