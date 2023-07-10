import axios from 'axios';

async function getZksTasks(address) {
    try {
        let url = `https://block-explorer-api.mainnet.zksync.io/transactions?address=${address}&limit=100&page=1`;
        const response = await axios.get(url);
        const pageValue = parseInt(response.data.meta.totalPages);
        let contractAddresses = response.data.items.map(item => item["to"]);
        if (pageValue > 1) {
            contractAddresses = [];
            for (let i = 1; i <= pageValue; i++) {
                const url = `https://block-explorer-api.mainnet.zksync.io/transactions?address=${address}&limit=100&page=${i}`;
                const response = await axios.get(url);
                let newcontractAddresses = response.data.items.map(item => item["to"]);
                contractAddresses = contractAddresses.concat(newcontractAddresses);
            }
        }
        contractAddresses = contractAddresses.map(item => item.toLowerCase());
        return contractAddresses;

    } catch (error) {
        console.error(error);
        return "Error";
    }
}

export default getZksTasks;