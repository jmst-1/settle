function crc16(str: string) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i += 1) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j += 1) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function tlv(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

export function generatePayNowQR(proxy: string, amount: number, type: "mobile" | "uen" = "mobile") {
  const amt = Number(amount).toFixed(2);
  const isMobile = type === "mobile";
  const phone = isMobile
    ? proxy.startsWith("+")
      ? proxy
      : `+65${proxy.replace(/\s/g, "")}`
    : proxy;

  const proxyField = isMobile
    ? tlv("00", phone)
    : tlv("01", phone);
  const guid =
    tlv("00", "SG.PAYNOW") +
    "01011" +
    proxyField +
    "02011" +
    tlv("03", amt);
  const acct = tlv("00", guid);
  const body = `000201${acct}5303702${tlv("54", amt)}5802SG6304`;
  return body + crc16(body);
}
