import secrets
import string

def generate_key(length=32):
    """生成指定长度的随机密钥"""
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(length))

# 生成 32 位密钥
key = generate_key(32)
print(f"生成的密钥: {key}")
print(f"密钥长度: {len(key)}")
