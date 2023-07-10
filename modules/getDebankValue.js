import axios from 'axios';

async function getDebankValue(address) {
    try {
        let url = "https://api.debank.com/user/addr?addr=" + address;
        const response = await axios.get(url);
        const debankValue = response.data.data.usd_value;
        return debankValue.toFixed(2);
    } catch (error) {
        console.error(error);
        return "Error";
    }
}

export default getDebankValue;