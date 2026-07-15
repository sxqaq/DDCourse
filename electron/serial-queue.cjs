function createSerialQueue(worker) {
  let tail = Promise.resolve();
  return input => {
    const operation = tail.catch(() => undefined).then(() => worker(input));
    tail = operation;
    return operation;
  };
}

module.exports = { createSerialQueue };
