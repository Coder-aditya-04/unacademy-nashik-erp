export const greetingFor = (date = new Date()) => {
    const h = date.getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
