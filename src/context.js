const Context = () => {
  const profile = `${PROFILE}`;
  const context = (p) => {
    switch (p) {
      case 'local':
        return { loggable: true };
      case 'development':
        return { loggable: true };
      case 'production':
        return { loggable: false };
    }
  };

  return context(profile);
};

export default Context;
