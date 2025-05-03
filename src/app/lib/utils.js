const { Newspaper } = require('lucide-react');
const foodMap = require('../../public/foodMap.json');

function processVotes(restos, votesArr) {
    maxVotesIndices = getMaxIndices(votesArr);
    bestRestos = []
    for (var i = 0; i < maxVotesIndices.length; i++) {
        bestRestos.push(restos[maxVotesIndices[i]]);
        bestRestos[i].id = i;
    }

    return bestRestos;
}

function getMaxIndices(arr) {
    const max = Math.max(...arr);
    
    const indices = [];
    arr.forEach((value, index) => {
      if (value === max) {
        indices.push(index);
      }
    });
    
    return indices;
  }

function processRawRestoData() {

}


function processData(clientInput, numOfClients) {
    formatClientInput(clientInput);
    console.log('formatted input');
    console.log(clientInput);

    clientInputCompiled = [];

    clientInputCompiled.push(processRestoNums(numOfClients, clientInput[0], clientInput[1]));
    clientInputCompiled.push(averageRemoveOutliers(clientInput[2]));
    clientInputCompiled.push(average(clientInput[3]));

    console.log(clientInputCompiled)
    return clientInputCompiled;
}

function formatClientInput(clientInput) {
    for (let i = 0; i < clientInput.length; i++) {
        tempArray = [];
        for (var key in clientInput[i]) {
            if (i <= 1 ) {
                tempArray.push(Object.values(clientInput[i][key]));
            }
            else {
                tempArray.push(clientInput[i][key])
            }
        }
        clientInput[i] = tempArray;
    }

    console.log(clientInput);
}    

function processRestoNums(numOfClients, foodTypeWantInput, foodTypeDontWantInput) {
    //const RestaurantTypes = {};


    numOfRestos = (numOfClients > 6) ? Math.round(2.3*Math.sqrt(numOfClients)) : 5;

    const votes = getBestFoodTypeWant(foodTypeWantInput, foodTypeDontWantInput);


    // 1. Get all cuisine types and compute total votes
    const cuisines = Object.keys(votes);
    const totalVotes = cuisines.reduce((sum, foodType) => sum + votes[foodType], 0);

    // 2. Calculate the exact quota for each cuisine,
    // assign the floor of the quota and record the remainders.
    const allocations = {};
    const remainders = [];
    let allocatedSeats = 0;

    cuisines.forEach(foodType => {
    const exactQuota = (votes[foodType] / totalVotes) * numOfRestos;
    const baseAllocation = Math.floor(exactQuota);
    allocations[foodType] = baseAllocation;
    allocatedSeats += baseAllocation;
    remainders.push({ foodType, remainder: exactQuota - baseAllocation });
    });

    // 3. Determine how many seats remain to be allocated
    const remainingSeats = numOfRestos - allocatedSeats;

    // 4. Allocate remaining seats based on the largest remainders
    remainders.sort((a, b) => b.remainder - a.remainder);
    for (let i = 0; i < remainingSeats; i++) {
    allocations[remainders[i].foodType]++;
    }

    for (var key in allocations) {
        if (allocations[key] === 0) {
            delete allocations[key];
        }
    }


    console.log("after Hamilton Allocation:")
    console.log(allocations);

    return allocations;

    /*
    // 5. Optionally, convert the allocations object to an array of [foodType, allocatedSeats]
    const restoNums = Object.entries(allocations);
    */

    

}

function getBestFoodTypeWant(foodTypeWantInput, foodTypeDontWantInput) {

    let tempFoodTypeWant = {};
    
    // summing votes
    for (let i = 0; i < foodTypeWantInput.length; i++) {
        for (let j = 0; j < foodTypeWantInput[i].length; j++) {
            let bonus = 1;

            switch (foodTypeWantInput[i].length) {
            case 1:
                bonus = 6;
                break;
            case 2:
                bonus = -2*j+4
                break;
            case 3:
                bonus = -1*j+3
                break;
            }  

            let key = foodTypeWantInput[i][j];
            tempFoodTypeWant[key] = (tempFoodTypeWant[key] || 0) + bonus;
        }
    }
    
    console.log('directly after summing votes')
    console.log(tempFoodTypeWant);

    // subtracting don't want votes
    for (let i = 0; i < foodTypeDontWantInput.length; i++) {

        let key = foodTypeDontWantInput[i][0];

        if (tempFoodTypeWant[key]!== undefined && tempFoodTypeWant[key] > 2) {
            tempFoodTypeWant[key] -= 2;
        }
        else if (tempFoodTypeWant[key]!== undefined && tempFoodTypeWant[key] < 2) {
            delete tempFoodTypeWant[key];
        }
    }

    let devolvedFoodTypeWant = devolveObj(tempFoodTypeWant);

    console.log("tempFoodTypeWant: ")
    console.log(tempFoodTypeWant);
    console.log("devolvedFoodTypeWant: ")
    console.log(devolvedFoodTypeWant)


    // if devolved returns a better concentration of food types than original, use devolved. Else, use original
    if (Object.keys(devolvedFoodTypeWant).length < Object.keys(tempFoodTypeWant).length) {
        return devolvedFoodTypeWant;
    } else {
        return tempFoodTypeWant;
    }
}

function devolveObj(object) {
    let devolvedFoodTypeWant = {};

    for (var foodType in object) {
        if (object[foodType] <= 3) {
            devolvedFoodType = devolve(foodType);
            devolvedFoodTypeWant[devolvedFoodType] = (devolvedFoodTypeWant[devolvedFoodType] || 0) + object[foodType];
        } else {
            devolvedFoodTypeWant[foodType] = (devolvedFoodTypeWant[foodType] || 0) + object[foodType];
        }
    }

    return devolvedFoodTypeWant;
}


const checkIfKeyExist = (objectName, keyName) => {
    let keyExist = Object.keys(objectName).some(key => key === keyName);
    return keyExist;
};


function devolve(foodName) {
    devolved = findKey(foodMap, foodName);

    if (devolved == null) {
        return foodName;
    }
    else {
        return devolved;
    }

}

function devolveUseAPI(foodName) {
    const requestBody = {
        title: foodName,
    };

    fetch(url, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
    })
    .then(response => response.json())
    .then(data => {

        console.log('Cuisine:', data.cuisine);
        console.log('Cuisines:', data.cuisines);
        console.log('Confidence:', data.confidence);

        if (data.confidence != 0) {
            return data.cuisine.toLowerCase;
        }
        else {
            return requestBody.title;
        }
    })
    .catch(error => {
        console.error('Error:', error);
    });
}

function findKey(obj, searchString) {
    for (const [key, values] of Object.entries(obj)) {
      if (values.includes(searchString)) {
        return key;
      }
    }
    return null; // Return null if not found
  }

function average(array) {
    sum = 0;
    for (let i = 0; i < array.length; i++) {
        sum += array[i];
    }

    return Math.round(sum / array.length)
}

function averageRemoveOutliers(array) {
    newArray = [...array];

    [mean, standardDev] = getStandardDeviation(array);

    for (let i = 0; i < newArray.length; i++) {
        if (newArray[i] > mean + 2*standardDev || newArray[i] < mean - 2*standardDev) {
            newArray.splice(i, i);
        }
    }

    return average(newArray);
}

function getStandardDeviation (array) {
    const n = array.length
    const mean = array.reduce((a, b) => a + b) / n
    return [mean, Math.sqrt(array.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n)]
  }

module.exports = {
    processData,
    processRestoNums,
    getBestFoodTypeWant,
    devolveObj,
    checkIfKeyExist,
    devolve,
    devolveUseAPI,
    findKey,
    average,
    averageRemoveOutliers,
    formatClientInput,
    getMaxIndices,
    processVotes,
};