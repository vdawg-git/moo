declare global {
	// Typescript doesnt like readonly arrays that much. But we do
	// see https://github.com/microsoft/TypeScript/issues/17002#issuecomment-2781717755
	interface ArrayConstructor {
		isArray(arg: Any): arg is readonly Any[]
	}
}

export {}
