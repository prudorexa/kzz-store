const nf = new Intl.NumberFormat("en-KE");
export const formatKSh = (n) => `KSh ${nf.format(n)}`;
