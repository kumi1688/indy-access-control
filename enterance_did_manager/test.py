import codec
import json
import sys

value = sys.argv[1]
a = codec.encode(value)
print(a)
