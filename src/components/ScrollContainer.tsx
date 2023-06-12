import tw, { styled } from 'twin.macro'

const ScrollContainer = styled.div`
  scroll-behavior: smooth;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
    box-shadow: 0;
  }

  &::-webkit-scrollbar-thumb {
    ${tw`bg-gray-800 opacity-75`}
    border-radius: 8px;
  }

  &:hover::-webkit-scrollbar-thumb {
    ${tw`bg-gray-700`}
  }
`

export default ScrollContainer
